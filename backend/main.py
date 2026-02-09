from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
import time
import random
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

load_dotenv()

import uvicorn
import asyncio
import json
import base64
from gemini_client import GeminiLiveClient
from gemini_vision import GeminiVisionClient
from pose_database import add_pose, get_pose, list_all_poses, save_to_file, get_pose_with_steps
from coach import CoachStateMachine
import re

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backend_debug.log", mode='w')
    ]
)
logger = logging.getLogger("mcai-backend")

app = FastAPI()

# ============== THREE-PHASE SESSION STATE ==============

class SessionPhase(Enum):
    FRAMING = "framing"      # Phase 1: Camera setup
    POSING = "posing"        # Phase 2: Pose corrections
    SHUTTER = "shutter"      # Phase 3: Countdown & capture

# Minimum phase durations (in seconds)
MIN_PHASE1_DURATION = 8.0   # Framing: let Gemini finish intro
MIN_PHASE2_DURATION = 15.0  # Posing: give user time to adjust

# Turn management - prevent rapid end_of_turn spam
MIN_END_OF_TURN_GAP = 3.0   # Minimum 3 seconds between end_of_turn=True sends

# Encouragement tips for when pose is good (English)
ENCOURAGEMENT_TIPS = [
    "tighten your core", "relax your shoulders", "give me a smile",
    "look at the camera", "take a deep breath", "tuck your chin slightly",
    "chest out", "relax your face", "perfect, hold it"
]

# System instruction for Gemini - friendly tourist photo helper (English)
# FIXED: Enforces specific directional instructions AND strict feedback rules
SYSTEM_INSTRUCTION = """You are MCai, a friendly photography assistant helping take travel photos.

CRITICAL RULE - Every correction MUST follow this formula:
  [BODY PART] — [DIRECTION] + [ACTION]

NEVER use vague words like: "confident", "natural", "relax", "look good", "stand tall"
ALWAYS give physical, directional instructions.

BAD examples (too vague - NEVER say these):
- "Look confident"
- "Stand tall"
- "Relax your shoulders"
- "Natural expression"

GOOD examples (specific + directional - ALWAYS say these):
- "Right hand — place it on your hip"
- "Chin — lift it up toward the ceiling"
- "Shoulders — pull them down and back"
- "Left foot — step it forward 6 inches"
- "Head — tilt it slightly to your right"

STRICT FEEDBACK RULES:
- NEVER say "great", "perfect", "beautiful", "amazing" unless ALL steps are complete
- If user hasn't moved yet, repeat the instruction, don't compliment
- Brief confirmations only between steps: "OK", "Got it", "Next one"
- Save real encouragement for when ALL steps pass
- If the message says "RULE: Do NOT praise" - follow it strictly
- If the message says "neutral_confirm" - only say "OK" or "Got it" or "Next"

Key rules:
1. Speak like a friend helping out - casual and brief
2. One short sentence at a time, max 12 words
3. Fix only ONE body part per instruction
4. Be encouraging but SPECIFIC
5. Follow STRICT FEEDBACK RULES above

Three phases:
- FRAMING: Tell the photographer how to hold the phone (vertical/horizontal, crouch/stand, center the subject)
- POSING: Give SPECIFIC body part + direction instructions (not vague "look natural")
- SHUTTER: Count down "3, 2, 1"

Example POSING responses:
- "Right elbow — push it back toward the wall behind you"
- "Chin — lift it up, like looking at the top of a door"
- "Feet — spread them wider, shoulder-width apart"
- "Left hand — drop it down to your side"
- "Head — turn it 10 degrees to your left"
"""

@dataclass
class SessionState:
    """Tracks the current session state across all three phases"""
    phase: SessionPhase = SessionPhase.FRAMING
    target_pose: Optional[Dict[str, Any]] = None

    # Phase timing - track when each phase started
    phase_start_time: float = 0.0

    # Phase 1 - Framing
    framing_started: bool = False
    framing_stable_start: float = 0.0

    # Phase 2 - Posing (Coach Mode)
    coach: Optional[CoachStateMachine] = None
    last_coach_tick_time: float = 0.0
    coach_tick_interval: float = 1.0  # Coach tick every 1 second
    last_regression_check_time: float = 0.0
    regression_check_interval: float = 2.0  # Check for regression every 2 seconds

    # Legacy pose feedback (fallback if no steps)
    last_pose_send_time: float = 0.0
    pose_send_interval: float = 4.0  # Send pose data every 4 seconds

    # Phase 3 - Shutter
    good_pose_start: float = 0.0
    good_pose_threshold: float = 1.5  # Must be good for 1.5 seconds
    countdown_started: bool = False
    shots_taken: int = 0

    # Pose history for stability detection
    recent_deviations: List[float] = field(default_factory=list)

    def reset_for_new_pose(self):
        """Reset state when a new target pose is set"""
        self.phase = SessionPhase.FRAMING
        self.phase_start_time = time.time()  # Track phase start
        self.framing_started = False
        self.framing_stable_start = 0.0
        self.coach = None
        self.last_coach_tick_time = 0.0
        self.last_regression_check_time = 0.0
        self.last_pose_send_time = 0.0
        self.good_pose_start = 0.0
        self.countdown_started = False
        self.recent_deviations = []

# MediaPipe 关键点索引映射
POSE_LANDMARKS = {
    0: "nose", 1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear", 9: "mouth_left", 10: "mouth_right",
    11: "left_shoulder", 12: "right_shoulder", 13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist", 17: "left_pinky", 18: "right_pinky",
    19: "left_index", 20: "right_index", 21: "left_thumb", 22: "right_thumb",
    23: "left_hip", 24: "right_hip", 25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle", 29: "left_heel", 30: "right_heel",
    31: "left_foot_index", 32: "right_foot_index"
}

import math

def calculate_angle(p1, p2, p3):
    """计算三个点形成的角度（以 p2 为顶点）"""
    try:
        v1 = (p1['x'] - p2['x'], p1['y'] - p2['y'])
        v2 = (p3['x'] - p2['x'], p3['y'] - p2['y'])

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

        if mag1 * mag2 == 0:
            return 0

        cos_angle = max(-1, min(1, dot / (mag1 * mag2)))
        angle = math.acos(cos_angle)
        return int(math.degrees(angle))
    except:
        return 0

def format_pose_for_gemini(landmarks: list) -> str:
    """将 33 个关键点转换为人类可读的姿势描述"""

    # 构建字典方便访问
    lm = {item['idx']: item for item in landmarks}

    # 提取关键关节位置
    parts = []

    # 1. 头部位置
    if 0 in lm:
        nose = lm[0]
        head_pos = "center" if 0.4 < nose['x'] < 0.6 else ("left" if nose['x'] < 0.4 else "right")
        head_tilt = "level" if 0.3 < nose['y'] < 0.5 else ("high" if nose['y'] < 0.3 else "low")
        parts.append(f"Head: {head_pos}, {head_tilt}")

    # 2. 肩膀
    if 11 in lm and 12 in lm:
        l_sh, r_sh = lm[11], lm[12]
        shoulder_diff = abs(l_sh['y'] - r_sh['y'])
        shoulder_level = "level" if shoulder_diff < 0.03 else ("left higher" if l_sh['y'] < r_sh['y'] else "right higher")
        shoulder_width = round(abs(r_sh['x'] - l_sh['x']), 2)
        parts.append(f"Shoulders: {shoulder_level}, width={shoulder_width}")

    # 3. 手肘角度
    if all(i in lm for i in [11, 13, 15]):  # 左臂
        left_elbow_angle = calculate_angle(lm[11], lm[13], lm[15])
        parts.append(f"Left elbow: {left_elbow_angle}°")

    if all(i in lm for i in [12, 14, 16]):  # 右臂
        right_elbow_angle = calculate_angle(lm[12], lm[14], lm[16])
        parts.append(f"Right elbow: {right_elbow_angle}°")

    # 4. 手腕位置
    if 15 in lm and 16 in lm:
        l_wrist, r_wrist = lm[15], lm[16]
        left_hand_pos = "raised" if l_wrist['y'] < 0.4 else ("waist" if l_wrist['y'] < 0.6 else "down")
        right_hand_pos = "raised" if r_wrist['y'] < 0.4 else ("waist" if r_wrist['y'] < 0.6 else "down")
        parts.append(f"Left hand: {left_hand_pos}, Right hand: {right_hand_pos}")

    # 5. 膝盖角度
    if all(i in lm for i in [23, 25, 27]):  # 左腿
        left_knee_angle = calculate_angle(lm[23], lm[25], lm[27])
        parts.append(f"Left knee: {left_knee_angle}°")

    if all(i in lm for i in [24, 26, 28]):  # 右腿
        right_knee_angle = calculate_angle(lm[24], lm[26], lm[28])
        parts.append(f"Right knee: {right_knee_angle}°")

    # 6. 脚的位置
    if 27 in lm and 28 in lm:
        l_ankle, r_ankle = lm[27], lm[28]
        feet_width = round(abs(r_ankle['x'] - l_ankle['x']), 2)
        feet_visible = lm[27].get('v', 0) > 0.5 and lm[28].get('v', 0) > 0.5
        parts.append(f"Feet: width={feet_width}, visible={feet_visible}")

    # 7. 整体姿态判断
    if 23 in lm and 24 in lm and 11 in lm and 12 in lm:
        # 躯干倾斜
        hip_center_x = (lm[23]['x'] + lm[24]['x']) / 2
        shoulder_center_x = (lm[11]['x'] + lm[12]['x']) / 2
        lean = "neutral"
        if shoulder_center_x - hip_center_x > 0.05:
            lean = "leaning right"
        elif hip_center_x - shoulder_center_x > 0.05:
            lean = "leaning left"
        parts.append(f"Torso: {lean}")

    return "[POSE DATA] " + " | ".join(parts)


def format_target_pose_context(pose_data: dict) -> str:
    """
    Convert target pose to Gemini context message.
    Tells Gemini what pose the user is trying to achieve.
    """
    name = pose_data.get('name', 'Unknown Pose')
    description = pose_data.get('description', '')
    head = pose_data.get('head', 'Natural position')
    hands = pose_data.get('hands', 'Relaxed by sides')
    feet = pose_data.get('feet', 'Shoulder-width apart')
    tips = pose_data.get('tips', [])

    context = f"""[TARGET POSE UPDATE]
The user selected pose: "{name}"

Camera position: {description}

Target pose requirements:
- HEAD: {head}
- HANDS/ARMS: {hands}
- FEET/LEGS: {feet}

Tips:
{chr(10).join(f'- {tip}' for tip in tips[:3]) if tips else '- Stay relaxed and natural'}

Guide the user based on this target pose. When pose data arrives, compare against the target and give brief corrections.
Fix only ONE issue at a time. Be casual and encouraging!"""

    return context


# ============== GRID HIGHLIGHT SYSTEM ==============

def compute_grid_highlights(landmarks: list, shot_type: str = 'full_body_standing') -> list:
    """
    Compute grid highlight states for UI feedback.

    Returns list of highlights with:
    - id: 'A_line', 'C_line', 'point_jia', 'point_yi'
    - color: 'green', 'yellow', 'amber'
    - pulse: True/False
    - fade_ms: milliseconds to fade out (only for green)
    """
    highlights = []

    if not landmarks or len(landmarks) < 33:
        return highlights

    lm = {item['idx']: item for item in landmarks}

    # Need eyes for most calculations
    if 2 not in lm or 5 not in lm:
        return highlights

    # Eye midpoint (landmarks 2 and 5 are left/right inner eyes)
    eye_y = (lm[2]['y'] + lm[5]['y']) / 2
    eye_x = (lm[2]['x'] + lm[5]['x']) / 2

    A_LINE = 0.333  # Top 1/3 horizontal line

    # 1) Eyes -> A-line (top 1/3 horizontal)
    eye_dev = abs(eye_y - A_LINE)
    if eye_dev > 0.12:
        highlights.append({"id": "A_line", "color": "amber", "pulse": True})
    elif eye_dev > 0.05:
        highlights.append({"id": "A_line", "color": "yellow", "pulse": True})
    else:
        highlights.append({"id": "A_line", "color": "green", "pulse": False, "fade_ms": 1500})

    # 2) Feet -> C-line (bottom edge, full body only)
    if shot_type in ['full_body_standing', 'low_angle_standing', 'full_body']:
        if 31 in lm and 32 in lm:
            feet_y = max(lm[31]['y'], lm[32]['y'])
            if feet_y < 0.85:
                highlights.append({"id": "C_line", "color": "amber", "pulse": True})
            elif feet_y < 0.92:
                highlights.append({"id": "C_line", "color": "yellow", "pulse": True})
            else:
                highlights.append({"id": "C_line", "color": "green", "pulse": False, "fade_ms": 1500})

    # 3) Face -> nearest intersection point (jia or yi)
    # jia = left intersection (0.333, 0.333)
    # yi = right intersection (0.667, 0.333)
    target_id = "point_jia" if eye_x < 0.5 else "point_yi"
    target_x = 0.333 if eye_x < 0.5 else 0.667
    point_dev = max(abs(eye_x - target_x), abs(eye_y - A_LINE))

    if point_dev > 0.15:
        highlights.append({"id": target_id, "color": "amber", "pulse": True})
    elif point_dev > 0.06:
        highlights.append({"id": target_id, "color": "yellow", "pulse": True})
    else:
        highlights.append({"id": target_id, "color": "green", "pulse": False, "fade_ms": 1500})

    return highlights


# ============== PHASE 1: FRAMING HELPERS ==============

def analyze_framing(landmarks: list) -> dict:
    """
    Analyze body position in frame for Phase 1 (Framing).
    Returns framing quality metrics.
    """
    if not landmarks or len(landmarks) < 33:
        return {"quality": "no_body", "issues": ["Cannot detect person"]}

    lm = {item['idx']: item for item in landmarks}
    issues = []

    # Calculate body bounding box
    xs = [lm[i]['x'] for i in lm if lm[i].get('v', 0) > 0.3]
    ys = [lm[i]['y'] for i in lm if lm[i].get('v', 0) > 0.3]

    if not xs or not ys:
        return {"quality": "no_body", "issues": ["Person not visible"]}

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # Body size ratio (how much of frame the body occupies)
    body_width = max_x - min_x
    body_height = max_y - min_y
    body_size = body_width * body_height

    # Center position
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    # Check centering (ideal: center_x ~ 0.5)
    if center_x < 0.3:
        issues.append("Subject is too far left")
    elif center_x > 0.7:
        issues.append("Subject is too far right")

    # Check if body is too small (far away)
    if body_size < 0.08:
        issues.append("Subject too small, move closer")
    elif body_size > 0.6:
        issues.append("Subject too big, step back")

    # Check if head is cut off
    if 0 in lm and lm[0]['y'] < 0.05:
        issues.append("Head is getting cut off at top")

    # Check if feet are visible (for full body shots)
    feet_visible = all(i in lm and lm[i].get('v', 0) > 0.5 for i in [27, 28])

    quality = "good" if len(issues) == 0 else ("minor" if len(issues) == 1 else "major")

    return {
        "quality": quality,
        "issues": issues,
        "center_x": center_x,
        "center_y": center_y,
        "body_size": body_size,
        "feet_visible": feet_visible
    }


def generate_framing_prompt(pose_data: dict) -> str:
    """
    Generate Phase 1 framing instructions for the photographer.
    """
    description = pose_data.get('description', 'Front view at eye level')

    return f"""[FRAMING PHASE]
Target camera position: {description}

Give 1-2 short instructions for the photographer on how to position the phone.
Examples: "Hold phone vertical", "Crouch down a bit", "Center the subject"."""


# ============== PHASE 2: POSING HELPERS ==============

def calculate_pose_deviation(landmarks: list, target_pose: dict) -> dict:
    """
    Compare current pose with target pose.
    Returns deviation level, score, and specific issues with context.

    Scoring: 0 = perfect, 1-2 issues = minor, 3+ issues = major
    Each issue includes both what's wrong AND what the target is.
    """
    if not landmarks or len(landmarks) < 33:
        return {"level": "unknown", "score": 100, "issues": [], "target_pose": target_pose}

    lm = {item['idx']: item for item in landmarks}
    issues = []

    # Get target pose requirements (normalize to lowercase for matching)
    target_head = target_pose.get('head', '').lower()
    target_hands = target_pose.get('hands', '').lower()
    target_feet = target_pose.get('feet', '').lower()

    # ========== HEAD POSITION CHECKS ==========
    if 0 in lm:
        nose = lm[0]
        nose_x, nose_y = nose['x'], nose['y']

        # Check if chin should be raised/lifted
        chin_keywords = ['chin up', 'chin high', 'lift chin', 'raised', 'look up', 'tilt up']
        if any(kw in target_head for kw in chin_keywords):
            if nose_y > 0.35:  # Nose too low = chin not raised
                issues.append({
                    "current": "Chin is too low",
                    "target": target_head,
                    "instruction": "Lift your chin up slightly"
                })

        # Check if chin should be tucked/lowered
        tuck_keywords = ['chin down', 'tuck', 'lower chin', 'look down']
        if any(kw in target_head for kw in tuck_keywords):
            if nose_y < 0.25:  # Nose too high = chin not tucked
                issues.append({
                    "current": "Chin is too high",
                    "target": target_head,
                    "instruction": "Tuck your chin down a bit"
                })

        # Check if head should be tilted/angled
        tilt_keywords = ['tilt', 'angle', 'slight turn', 'turn head']
        if any(kw in target_head for kw in tilt_keywords):
            if 0.42 < nose_x < 0.58:  # Head too centered when should be tilted
                issues.append({
                    "current": "Head is facing straight ahead",
                    "target": target_head,
                    "instruction": "Turn your head slightly to the side"
                })

    # ========== SHOULDER CHECKS ==========
    if 11 in lm and 12 in lm:
        l_shoulder, r_shoulder = lm[11], lm[12]
        shoulder_diff = abs(l_shoulder['y'] - r_shoulder['y'])

        # Check if shoulders should be level
        if shoulder_diff > 0.06:
            higher_side = "left" if l_shoulder['y'] < r_shoulder['y'] else "right"
            issues.append({
                "current": f"Shoulders are uneven ({higher_side} is higher)",
                "target": "Shoulders level",
                "instruction": "Relax and level your shoulders"
            })

        # Check if one shoulder should be dropped
        drop_keywords = ['drop shoulder', 'one shoulder lower', 'asymmetric']
        if any(kw in target_hands for kw in drop_keywords) or any(kw in target_head for kw in drop_keywords):
            if shoulder_diff < 0.03:  # Shoulders too level when should be dropped
                issues.append({
                    "current": "Shoulders are too level",
                    "target": "One shoulder slightly dropped",
                    "instruction": "Drop one shoulder slightly for a relaxed look"
                })

    # ========== HAND/ARM POSITION CHECKS ==========
    if 15 in lm and 16 in lm and 23 in lm and 24 in lm:
        l_wrist, r_wrist = lm[15], lm[16]
        l_hip, r_hip = lm[23], lm[24]

        # Calculate hip level (average y of hips)
        hip_y = (l_hip['y'] + r_hip['y']) / 2

        # Check if hands should be on waist/hip
        waist_keywords = ['waist', 'hip', 'on hip', 'akimbo', 'hands on hips']
        if any(kw in target_hands for kw in waist_keywords):
            # Check left hand
            l_near_hip = abs(l_wrist['y'] - hip_y) < 0.15 and abs(l_wrist['x'] - l_hip['x']) < 0.2
            r_near_hip = abs(r_wrist['y'] - hip_y) < 0.15 and abs(r_wrist['x'] - r_hip['x']) < 0.2

            if not l_near_hip and not r_near_hip:
                if l_wrist['y'] > hip_y + 0.15:
                    issues.append({
                        "current": "Hands are down at your sides",
                        "target": target_hands,
                        "instruction": "Put your hand on your hip"
                    })
                elif l_wrist['y'] < hip_y - 0.2:
                    issues.append({
                        "current": "Hands are raised too high",
                        "target": target_hands,
                        "instruction": "Lower your hand to your waist"
                    })

        # Check if hands should be relaxed/down
        down_keywords = ['relaxed', 'down', 'by side', 'natural', 'hanging']
        if any(kw in target_hands for kw in down_keywords):
            if l_wrist['y'] < 0.55 or r_wrist['y'] < 0.55:
                issues.append({
                    "current": "Arms are raised",
                    "target": target_hands,
                    "instruction": "Let your arms hang naturally"
                })

        # Check if hands should be crossed/folded
        cross_keywords = ['cross', 'fold', 'crossed arms']
        if any(kw in target_hands for kw in cross_keywords):
            # Wrists should be near center and close together
            wrist_center_x = (l_wrist['x'] + r_wrist['x']) / 2
            wrist_distance = abs(l_wrist['x'] - r_wrist['x'])
            if wrist_distance > 0.25 or abs(wrist_center_x - 0.5) > 0.15:
                issues.append({
                    "current": "Arms are apart",
                    "target": target_hands,
                    "instruction": "Cross your arms in front of you"
                })

        # Check if hands should be raised (e.g., touching hair, behind head)
        raise_keywords = ['raise', 'up', 'hair', 'behind head', 'above']
        if any(kw in target_hands for kw in raise_keywords):
            if l_wrist['y'] > 0.4 and r_wrist['y'] > 0.4:
                issues.append({
                    "current": "Arms are too low",
                    "target": target_hands,
                    "instruction": "Raise your arm up"
                })

    # ========== FEET/STANCE CHECKS ==========
    if 27 in lm and 28 in lm:
        l_ankle, r_ankle = lm[27], lm[28]
        feet_width = abs(r_ankle['x'] - l_ankle['x'])

        # Check if feet should be together
        together_keywords = ['together', 'close', 'feet close']
        if any(kw in target_feet for kw in together_keywords):
            if feet_width > 0.15:
                issues.append({
                    "current": "Feet are too far apart",
                    "target": target_feet,
                    "instruction": "Bring your feet closer together"
                })

        # Check if feet should be apart
        apart_keywords = ['apart', 'wide', 'shoulder width', 'spread']
        if any(kw in target_feet for kw in apart_keywords):
            if feet_width < 0.1:
                issues.append({
                    "current": "Feet are too close together",
                    "target": target_feet,
                    "instruction": "Spread your feet shoulder-width apart"
                })

        # Check for staggered/stepped stance
        step_keywords = ['step', 'stagger', 'one foot forward', 'front foot']
        if any(kw in target_feet for kw in step_keywords):
            feet_depth_diff = abs(l_ankle.get('z', 0) - r_ankle.get('z', 0))
            feet_y_diff = abs(l_ankle['y'] - r_ankle['y'])
            if feet_depth_diff < 0.05 and feet_y_diff < 0.05:
                issues.append({
                    "current": "Feet are side by side",
                    "target": target_feet,
                    "instruction": "Step one foot slightly forward"
                })

    # ========== SCORING ==========
    num_issues = len(issues)
    if num_issues == 0:
        level = "good"
        score = 0
    elif num_issues <= 2:
        level = "minor"
        score = num_issues
    else:
        level = "major"
        score = num_issues

    return {
        "level": level,
        "score": score,
        "issues": issues,  # Return all issues, not just first
        "target_pose": target_pose
    }


def generate_posing_prompt(deviation: dict, state: SessionState) -> str:
    """
    Generate Phase 2 posing instruction prompt for Gemini.
    Includes BOTH the specific issue AND the target instruction for context.
    Uses strict feedback rules from coach if available.
    """
    level = deviation.get('level', 'unknown')
    issues = deviation.get('issues', [])
    target_pose = deviation.get('target_pose', {})

    # Get strict feedback modifier from coach if active
    feedback_mod = ""
    if state.coach:
        feedback_mod = state.coach.get_feedback_prompt_modifier()

    if level == "good":
        # Good pose - but use strict feedback rules
        if state.coach:
            feedback_type = state.coach.get_allowed_feedback_type()
            if feedback_type == 'earned_praise':
                tip = random.choice(ENCOURAGEMENT_TIPS)
                return f"[POSING PHASE] Pose looks great! You can remind them to: {tip}"
            else:
                # Neutral confirmation only
                return f"[POSING PHASE] Position OK. Brief check: hold steady.{feedback_mod}"
        else:
            tip = random.choice(ENCOURAGEMENT_TIPS)
            return f"[POSING PHASE] Pose looks great! You can remind them to: {tip}"

    # Get the first/most important issue with full context
    if issues:
        issue = issues[0]
        if isinstance(issue, dict):
            current = issue.get('current', 'Position needs adjustment')
            target = issue.get('target', '')
            instruction = issue.get('instruction', 'Adjust your pose')

            if level == "major":
                return f"""[POSING PHASE - URGENT]
Issue: {current}
Target: {target}
Give ONE specific correction in under 10 words. Example: "{instruction}" """
            else:  # minor
                return f"""[POSING PHASE]
Small adjustment needed: {current}
Target: {target}
Give a friendly, brief tip. Example: "{instruction}" """
        else:
            # Fallback for string issues
            if level == "major":
                return f"[POSING PHASE - URGENT] Issue: {issue}. Give one specific correction."
            else:
                return f"[POSING PHASE] Small adjustment: {issue}. Give a brief tip."
    else:
        # No specific issues found but not "good"
        target_hands = target_pose.get('hands', 'natural position')
        return f"[POSING PHASE] Check if pose matches target. Hands should be: {target_hands}. Give one tip."


# ============== PHASE 3: SHUTTER HELPERS ==============

def check_shutter_ready(state: SessionState, deviation: dict) -> bool:
    """
    Check if ready for shutter (Phase 3).
    Pose must be good and stable for 1.5 seconds.
    """
    current_time = time.time()

    if deviation['level'] == "good":
        if state.good_pose_start == 0:
            state.good_pose_start = current_time
            return False

        elapsed = current_time - state.good_pose_start
        if elapsed >= state.good_pose_threshold:
            return True
    else:
        # Reset if pose becomes bad
        state.good_pose_start = 0

    return False


def generate_shutter_prompt() -> str:
    """Generate Phase 3 countdown prompt."""
    return "[SHUTTER PHASE] Pose is perfect! Do the countdown: 3, 2, 1"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "MCai Backend is Running"}

@app.get("/api/poses")
async def api_list_poses():
    """获取所有已存储的姿势"""
    return {"poses": list_all_poses()}

@app.post("/api/analyze-pose")
async def api_analyze_pose(body: dict):
    """
    分析上传的姿势图片（REST接口，供PlaylistView等非WS场景使用）
    body: { "image": "base64...", "source_name": "xxx" }
    """
    try:
        vision_client = GeminiVisionClient()
        image_data = body.get("image", "")
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]

        result = await vision_client.analyze_pose_image(
            base64_image=image_data,
            source_name=body.get("source_name", "uploaded")
        )

        pose_id = re.sub(r'[^a-z0-9]+', '-', result.get('title', 'pose').lower()).strip('-')
        add_pose(pose_id, result)
        save_to_file()

        return {"pose_id": pose_id, **result}
    except Exception as e:
        logger.error(f"Error in analyze_pose_endpoint: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.websocket("/ws/live")
async def live_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("=== CLIENT CONNECTED ===", flush=True)
    logger.info("Client connected to /ws/live")

    print("=== CREATING GEMINI CLIENT ===", flush=True)
    gemini_client = GeminiLiveClient()
    vision_client = GeminiVisionClient()

    # Session state for three-phase flow
    state = SessionState()

    # ===== TURN MANAGEMENT (Bug 1 Fix) =====
    # Prevents rapid end_of_turn=True spam that kills the session
    turn_in_progress = False
    last_end_of_turn_time = 0.0
    pending_prompts: asyncio.Queue = asyncio.Queue()

    # ===== SESSION LIFECYCLE (Bug 2 Fix) =====
    # Keeps receive loop alive until intentional close
    session_active = True

    async def send_with_turn_management(session, prompt: str, end_of_turn: bool = True):
        """
        Send a prompt to Gemini with turn management.
        If a turn is in progress or minimum gap not met, queue the prompt.
        """
        nonlocal turn_in_progress, last_end_of_turn_time

        current_time = time.time()
        time_since_last = current_time - last_end_of_turn_time

        if end_of_turn:
            # Check if we should queue instead of sending immediately
            if turn_in_progress:
                logger.info(f"Turn in progress, queueing prompt: {prompt[:50]}...")
                await pending_prompts.put(prompt)
                return

            if time_since_last < MIN_END_OF_TURN_GAP:
                logger.info(f"Too soon since last turn ({time_since_last:.1f}s < {MIN_END_OF_TURN_GAP}s), queueing: {prompt[:50]}...")
                await pending_prompts.put(prompt)
                return

            # OK to send
            turn_in_progress = True
            last_end_of_turn_time = current_time
            logger.info(f"Sending prompt with end_of_turn=True: {prompt[:50]}...")
            await session.send(input=prompt, end_of_turn=True)
        else:
            # Non-end_of_turn sends are always allowed
            await session.send(input=prompt, end_of_turn=False)

    async def process_pending_prompts(session):
        """Process one pending prompt from the queue after turn completes."""
        nonlocal turn_in_progress, last_end_of_turn_time

        if pending_prompts.empty():
            return

        # Get next prompt
        prompt = await pending_prompts.get()
        current_time = time.time()

        # Enforce minimum gap even for queued prompts
        time_since_last = current_time - last_end_of_turn_time
        if time_since_last < MIN_END_OF_TURN_GAP:
            wait_time = MIN_END_OF_TURN_GAP - time_since_last
            logger.debug(f"Waiting {wait_time:.1f}s before sending queued prompt...")
            await asyncio.sleep(wait_time)

        turn_in_progress = True
        last_end_of_turn_time = time.time()
        logger.info(f"Sending queued prompt: {prompt[:50]}...")
        await session.send(input=prompt, end_of_turn=True)

    try:
        print("=== CONNECTING TO GEMINI ===", flush=True)
        async with gemini_client.connect(system_instruction=SYSTEM_INSTRUCTION) as session:
            print("=== GEMINI SESSION ESTABLISHED ===", flush=True)

            async def send_to_gemini():
                """Receive from React, send to Gemini with three-phase logic"""
                nonlocal state, turn_in_progress, session_active
                try:
                    while session_active:
                        data = await websocket.receive_text()
                        msg = json.loads(data)

                        if msg.get("type") == "audio":
                            # msg['data'] is base64 PCM
                            pcm_bytes = base64.b64decode(msg['data'])

                            # Validation: Skip empty or tiny audio chunks
                            if len(pcm_bytes) < 100:
                                continue

                            logger.debug(f"Sending {len(pcm_bytes)} bytes of audio to Gemini")
                            await session.send_realtime_input(audio={"data": pcm_bytes, "mime_type": "audio/pcm;rate=16000"})

                        elif msg.get("type") == "image":
                            # msg['data'] is base64 JPEG
                            jpeg_bytes = base64.b64decode(msg['data'])
                            await session.send(input={"data": jpeg_bytes, "mime_type": "image/jpeg"}, end_of_turn=False)

                        elif msg.get("type") == "text":
                            await send_with_turn_management(session, msg['data'], end_of_turn=True)

                        elif msg.get("type") == "pose":
                            # ===== THREE-PHASE POSE HANDLING =====
                            landmarks = msg.get('data', [])
                            if not landmarks or len(landmarks) < 33:
                                continue

                            current_time = time.time()

                            # ===== GRID HIGHLIGHTS (Phase 1 & 2) =====
                            # Compute and send grid highlights for UI feedback
                            if state.phase in [SessionPhase.FRAMING, SessionPhase.POSING]:
                                shot_type = 'full_body_standing'  # Default, could be derived from target_pose
                                if state.target_pose:
                                    pose_cat = state.target_pose.get('category', '')
                                    if 'full' in str(pose_cat).lower() or 'body' in str(pose_cat).lower():
                                        shot_type = 'full_body_standing'
                                    elif 'upper' in str(pose_cat).lower() or 'half' in str(pose_cat).lower():
                                        shot_type = 'upper_body'

                                highlights = compute_grid_highlights(landmarks, shot_type)
                                if highlights:
                                    await websocket.send_json({
                                        "type": "grid_highlight",
                                        "highlights": highlights
                                    })

                            # ===== PHASE 1: FRAMING =====
                            if state.phase == SessionPhase.FRAMING:
                                framing = analyze_framing(landmarks)
                                logger.debug(f"Framing analysis: {framing}")

                                # Send framing prompt on first detection
                                if not state.framing_started and state.target_pose:
                                    state.framing_started = True
                                    prompt = generate_framing_prompt(state.target_pose)
                                    logger.info(f"Phase 1 - Sending framing prompt")
                                    await send_with_turn_management(session, prompt, end_of_turn=True)

                                # Check if framing is good
                                if framing['quality'] == 'good':
                                    if state.framing_stable_start == 0:
                                        state.framing_stable_start = current_time
                                    elif current_time - state.framing_stable_start > 2.0:
                                        # Check minimum phase duration before transitioning
                                        phase_elapsed = current_time - state.phase_start_time
                                        if phase_elapsed >= MIN_PHASE1_DURATION:
                                            # Framing stable for 2 seconds AND min duration met - transition to Phase 2
                                            state.phase = SessionPhase.POSING
                                            state.phase_start_time = current_time  # Reset for Phase 2
                                            state.last_pose_send_time = 0
                                            logger.info(f"=== TRANSITIONING TO PHASE 2: POSING (after {phase_elapsed:.1f}s) ===")
                                            await websocket.send_json({"type": "phase_change", "phase": "posing"})
                                            await send_with_turn_management(session, "[FRAMING COMPLETE] Now guide the model on their pose.", end_of_turn=True)
                                        else:
                                            logger.debug(f"Framing good but waiting for min duration ({phase_elapsed:.1f}s / {MIN_PHASE1_DURATION}s)")
                                else:
                                    state.framing_stable_start = 0
                                    # Send framing issues periodically
                                    if current_time - state.last_pose_send_time > 5.0 and framing['issues']:
                                        state.last_pose_send_time = current_time
                                        issue_text = framing['issues'][0]
                                        await send_with_turn_management(session, f"[FRAMING ISSUE] {issue_text}. Give the photographer a quick tip.", end_of_turn=True)

                            # ===== PHASE 2: POSING (COACH MODE) =====
                            elif state.phase == SessionPhase.POSING:
                                if not state.target_pose:
                                    continue

                                # Initialize coach if not already done
                                if state.coach is None:
                                    state.coach = CoachStateMachine()
                                    # Get pose with steps from database
                                    pose_id = state.target_pose.get('id', '')
                                    pose_with_steps = get_pose_with_steps(pose_id) if pose_id else None

                                    if pose_with_steps and pose_with_steps.get('steps'):
                                        coach_result = state.coach.start_pose(pose_with_steps)
                                    else:
                                        # Use target_pose directly (will generate default steps)
                                        coach_result = state.coach.start_pose(state.target_pose)

                                    if coach_result:
                                        logger.info(f"Coach started: {coach_result.get('message', '')[:60]}")
                                        # Send initial coach state to frontend
                                        await websocket.send_json({
                                            "type": "coach_state",
                                            "data": coach_result.get('state_update', {})
                                        })
                                        await send_with_turn_management(session, coach_result['message'], end_of_turn=True)

                                # Run coach tick at regular intervals
                                time_since_tick = current_time - state.last_coach_tick_time
                                if time_since_tick >= state.coach_tick_interval:
                                    state.last_coach_tick_time = current_time

                                    coach_result = state.coach.tick(landmarks)

                                    # Always send debug info if available (even when no action)
                                    if state.coach.session and state.coach.session.last_debug_info:
                                        debug_from_session = state.coach._format_debug_info()
                                        if debug_from_session:
                                            await websocket.send_json({
                                                "type": "coach_debug",
                                                "data": debug_from_session
                                            })

                                    if coach_result:
                                        action = coach_result.get('action', '')
                                        message = coach_result.get('message', '')
                                        logger.info(f"Coach {action}: {message[:60]}")

                                        # Send coach state update to frontend
                                        await websocket.send_json({
                                            "type": "coach_state",
                                            "data": coach_result.get('state_update', {})
                                        })

                                        # Send debug info if available
                                        debug_info = coach_result.get('debug_info')
                                        if debug_info:
                                            await websocket.send_json({
                                                "type": "coach_debug",
                                                "data": debug_info
                                            })

                                        # Send message to Gemini for TTS
                                        await send_with_turn_management(session, message, end_of_turn=True)

                                        # Check if pose is complete
                                        if action == 'complete':
                                            # All steps done - check if ready for shutter
                                            phase_elapsed = current_time - state.phase_start_time
                                            if phase_elapsed >= MIN_PHASE2_DURATION:
                                                state.phase = SessionPhase.SHUTTER
                                                state.phase_start_time = current_time
                                                state.countdown_started = True
                                                logger.info(f"=== TRANSITIONING TO PHASE 3: SHUTTER (coach complete) ===")
                                                await websocket.send_json({"type": "phase_change", "phase": "shutter"})
                                                await send_with_turn_management(session, generate_shutter_prompt(), end_of_turn=True)
                                                continue

                                # Check for regression periodically
                                time_since_regression = current_time - state.last_regression_check_time
                                if time_since_regression >= state.regression_check_interval:
                                    state.last_regression_check_time = current_time

                                    regression = state.coach.check_regression(landmarks)
                                    if regression:
                                        logger.warning(f"Regression detected: {regression.get('message', '')[:60]}")
                                        await websocket.send_json({
                                            "type": "coach_state",
                                            "data": regression.get('state_update', {})
                                        })
                                        await send_with_turn_management(session, regression['message'], end_of_turn=True)

                            # ===== PHASE 3: SHUTTER =====
                            elif state.phase == SessionPhase.SHUTTER:
                                # After countdown, send shutter event and loop back
                                if state.countdown_started:
                                    # Wait a bit for countdown to play
                                    await asyncio.sleep(3.0)
                                    state.countdown_started = False
                                    state.shots_taken += 1
                                    logger.info(f"=== SHUTTER! Shot #{state.shots_taken} ===")

                                    # Send shutter event to frontend
                                    await websocket.send_json({
                                        "type": "shutter",
                                        "shot_number": state.shots_taken
                                    })

                                    # Reset for next shot
                                    state.good_pose_start = 0
                                    state.phase = SessionPhase.POSING
                                    state.phase_start_time = time.time()  # Reset Phase 2 timer
                                    await websocket.send_json({"type": "phase_change", "phase": "posing"})

                                    # Prompt for micro-adjustment - use strict feedback if coach active
                                    tip = random.choice(ENCOURAGEMENT_TIPS)
                                    if state.coach:
                                        feedback_type = state.coach.get_allowed_feedback_type()
                                        if feedback_type == 'earned_praise':
                                            await send_with_turn_management(session, f"[SHOT TAKEN] Great shot! Let's take another. Suggest: {tip}", end_of_turn=True)
                                        else:
                                            await send_with_turn_management(session, f"[SHOT TAKEN] OK, got the shot. Next: {tip}", end_of_turn=True)
                                    else:
                                        await send_with_turn_management(session, f"[SHOT TAKEN] Great! Let's take another. Suggest: {tip}", end_of_turn=True)

                        elif msg.get("type") == "set_target_pose":
                            # Set target pose and start Phase 1
                            pose_data = msg.get('data', {})
                            state.target_pose = pose_data
                            state.reset_for_new_pose()
                            logger.info(f"Setting target pose: {pose_data.get('name', 'Unknown')}")
                            await websocket.send_json({"type": "phase_change", "phase": "framing"})

                            # Send target pose context (no end_of_turn)
                            target_context = format_target_pose_context(pose_data)
                            await send_with_turn_management(session, target_context, end_of_turn=False)

                            # Trigger Phase 1 framing guidance (with turn management)
                            framing_prompt = generate_framing_prompt(pose_data)
                            await send_with_turn_management(session, framing_prompt, end_of_turn=True)

                        elif msg.get("type") == "analyze_pose":
                            try:
                                image_data = msg.get("data", "")
                                if "base64," in image_data:
                                    image_data = image_data.split("base64,")[1]

                                result = await vision_client.analyze_pose_image(
                                    base64_image=image_data,
                                    source_name=msg.get("source_name", "uploaded")
                                )

                                pose_id = re.sub(r'[^a-z0-9]+', '-', result.get('title', 'pose').lower()).strip('-')
                                add_pose(pose_id, result)
                                save_to_file()

                                await websocket.send_json({
                                    "type": "pose_analyzed",
                                    "data": {"pose_id": pose_id, **result}
                                })
                                logger.info(f"Pose analyzed and saved: {pose_id}")
                            except Exception as e:
                                logger.error(f"Error analyzing pose: {e}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"Image analysis failed: {str(e)}"
                                })

                        elif msg.get("type") == "list_poses":
                            try:
                                poses = list_all_poses()
                                await websocket.send_json({"type": "poses_list", "data": poses})
                            except Exception as e:
                                logger.error(f"Error listing poses: {e}")

                except WebSocketDisconnect:
                    logger.info("Client disconnected from React")
                    session_active = False
                except Exception as e:
                    logger.error(f"Error in send_to_gemini: {e}")
                    session_active = False

            async def receive_from_gemini():
                """Receive from Gemini, send to React"""
                nonlocal turn_in_progress, session_active
                try:
                    logger.info("Starting receive_from_gemini loop...")

                    # ===== BUG 2 FIX: Wrap in while session_active =====
                    # This prevents the receive loop from exiting permanently
                    while session_active:
                        try:
                            async for response in session.receive():
                                if not session_active:
                                    break

                                # Handle Audio
                                server_content = response.server_content
                                if server_content is None:
                                    # Keep alive or empty turn
                                    continue

                                if server_content.model_turn:
                                    for part in server_content.model_turn.parts:
                                        try:
                                            if part.inline_data:
                                                try:
                                                    # Audio Data (PCM)
                                                    raw_data = part.inline_data.data
                                                    if raw_data:
                                                        # 1. Encode to base64 bytes
                                                        b64_bytes = base64.b64encode(raw_data)
                                                        # 2. Decode to UTF-8 String (Crucial for WebSocket Text Frames)
                                                        audio_str = b64_bytes.decode('utf-8')

                                                        await websocket.send_json({"type": "audio", "data": audio_str})
                                                except Exception as audio_err:
                                                    logger.error(f"Failed to encode/send audio: {audio_err}")

                                            # NOTE: part.text contains thinking tokens (like **Assessing**)
                                            # We only send output_transcription to frontend, not part.text
                                            if part.text:
                                                logger.debug(f"Ignoring part.text (likely thinking): {str(part.text)[:50]}...")

                                        except RuntimeError as e:
                                            # Starlette/FastAPI raises RuntimeError if connection is closed
                                            if "Unexpected ASGI message" in str(e) or "disconnect" in str(e).lower():
                                                logger.info("Client disconnected while sending Gemini response.")
                                                session_active = False
                                                break
                                            raise e

                                # Handle output_transcription (audio transcription for subtitles)
                                if hasattr(server_content, 'output_transcription') and server_content.output_transcription:
                                    try:
                                        transcription = server_content.output_transcription
                                        # Check if it has text attribute
                                        if hasattr(transcription, 'text') and transcription.text:
                                            text_response = str(transcription.text).strip()
                                            if text_response:
                                                logger.info(f"Transcription from Gemini: {text_response}")
                                                await websocket.send_json({"type": "text", "data": text_response})
                                    except Exception as trans_err:
                                        logger.error(f"Failed to process transcription: {trans_err}")

                                # ===== BUG 1 FIX: Handle Turn Complete =====
                                # Reset turn_in_progress and process pending prompts
                                if server_content.turn_complete:
                                    logger.debug("Turn complete - resetting turn_in_progress")
                                    turn_in_progress = False
                                    # Process any pending prompts
                                    await process_pending_prompts(session)

                            # If async for exits naturally, log but continue the outer while loop
                            logger.info("Gemini receive iterator completed, waiting for more...")
                            # Small delay before restarting to avoid tight loop
                            await asyncio.sleep(0.1)

                        except StopAsyncIteration:
                            logger.debug("Gemini receive StopAsyncIteration, continuing...")
                            await asyncio.sleep(0.1)
                            continue

                    logger.info("Receive loop exiting (session_active=False)")

                except Exception as e:
                    logger.error(f"Error in receive_from_gemini: {e}")
                    session_active = False
                    raise e

            # Run both tasks concurrently
            logger.info("Starting concurrent send/receive tasks...")
            done, pending = await asyncio.wait(
                [asyncio.create_task(send_to_gemini()), asyncio.create_task(receive_from_gemini())],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            logger.info(f"One of the tasks finished. Done: {len(done)}, Pending: {len(pending)}")
            for task in done:
                try:
                     task.result()
                     logger.info("Task finished successfully.")
                except Exception as task_err:
                     logger.error(f"Task failed with error: {task_err}")
            
            for task in pending:
                logger.info("Cancelling pending task...")
                task.cancel()

    except Exception as e:
        print(f"=== ERROR: {e} ===", flush=True)
        logger.error(f"Error in live_endpoint: {e}")
        import traceback
        traceback.print_exc()
        try:
            # Send error to frontend so we can see it in console
            # Truncate to 100 chars to fit WS reason limits
            reason_msg = str(e)[:100]
            await websocket.close(code=1011, reason=reason_msg)
        except RuntimeError:
            pass # Socket might already be closed
    finally:
        logger.info("Closing WebSocket from backend.")
        # Only close if not already closed
        try:
            if websocket.client_state != WebSocketDisconnect:
                 await websocket.close()
        except RuntimeError:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

