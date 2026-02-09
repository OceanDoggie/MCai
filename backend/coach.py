"""
Coach Mode State Machine

A sequential action correction system that guides users through poses
one step at a time, like a personal fitness trainer.

FIXED: Proper landmark verification with visibility checks and logging.
"""

import time
import math
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any, Tuple

logger = logging.getLogger("mcai-coach")

# ============== CONSTANTS ==============
WATCH_TIMEOUT = 8.0          # Max seconds to watch for completion (increased from 6)
PASS_THRESHOLD = 3           # Consecutive passes needed to confirm
MAX_ATTEMPTS = 5             # Max attempts before moving on
CHECK_INTERVAL = 1.0         # How often to check landmarks
ALMOST_THRESHOLD = 1.3       # Multiplier for "almost there" detection (tightened from 1.5)
ALMOST_FEEDBACK_INTERVAL = 3.0  # How often to send "almost" feedback
REGRESSION_COOLDOWN = 8.0    # Min seconds between regression warnings

# Visibility threshold - landmarks below this are considered not visible
MIN_VISIBILITY = 0.5

# ============== TIGHTENED THRESHOLDS ==============
# For normalized coordinates (0-1 range)
THRESHOLD_HAND_ON_HIP_DIST = 0.12      # Max distance from wrist to hip (tightened)
THRESHOLD_HAND_ON_HIP_Y = 0.10         # Max Y difference from hip level
THRESHOLD_HAND_ON_HIP_X = 0.15         # Max X difference from hip
THRESHOLD_SHOULDERS_LEVEL = 0.04       # Max Y difference between shoulders
THRESHOLD_FEET_APART = 0.12            # Min distance for "feet apart"
THRESHOLD_FEET_TOGETHER = 0.08         # Max distance for "feet together"
THRESHOLD_CHIN_ELEVATED = 0.03         # How much nose.y must be above shoulder_mid.y
THRESHOLD_HEAD_TILT = 0.08             # How far nose.x must be from center (0.5)
THRESHOLD_ARMS_DOWN = 0.55             # Min Y for "arms down" (lower = higher on screen)
THRESHOLD_ELBOW_BACK = 0.04            # How far elbow.x must be behind shoulder.x


class CoachState(Enum):
    IDLE = "idle"                    # Not started
    GIVE_INSTRUCTION = "instruction" # Announcing instruction
    WATCHING = "watching"            # Observing user's pose
    CONFIRMED = "confirmed"          # Step completed
    COMPLETE = "complete"            # All steps done


@dataclass
class StepProgress:
    """Tracks progress through a single step"""
    consecutive_passes: int = 0
    attempts: int = 0
    alt_explanation_index: int = 0
    last_check_time: float = 0.0
    last_almost_time: float = 0.0
    watch_start_time: float = 0.0


@dataclass
class DebugInfo:
    """Debug information for the current check"""
    check_type: str = ""
    landmarks_used: List[str] = field(default_factory=list)
    values: Dict[str, float] = field(default_factory=dict)
    thresholds: Dict[str, float] = field(default_factory=dict)
    passed: bool = False
    almost: bool = False
    reason: str = ""


@dataclass
class CoachSession:
    """Tracks the entire coaching session"""
    steps: List[Dict] = field(default_factory=list)
    current_step_index: int = 0
    state: CoachState = CoachState.IDLE
    step_progress: StepProgress = field(default_factory=StepProgress)
    completed_steps: List[int] = field(default_factory=list)
    pose_name: str = ""
    last_debug_info: Optional[DebugInfo] = None
    last_regression_time: float = 0.0  # For regression cooldown
    # Strict feedback tracking
    corrections_given: int = 0        # How many times user was corrected
    corrections_followed: int = 0     # How many corrections user actually followed
    last_check_passed: bool = False   # Whether the last landmark check passed


class CoachStateMachine:
    """
    State machine for coaching users through pose steps sequentially.

    Usage:
        coach = CoachStateMachine()
        coach.start_pose(pose_data)  # pose_data must have 'steps' array

        # In your main loop:
        result = coach.tick(landmarks)
        if result:
            send_to_gemini(result['message'])
    """

    def __init__(self):
        self.session: Optional[CoachSession] = None

    def start_pose(self, pose_data: Dict) -> Dict:
        """
        Start coaching a new pose.

        Args:
            pose_data: Must contain 'steps' array with step definitions

        Returns:
            Initial instruction to give to user
        """
        steps = pose_data.get('steps', [])
        if not steps:
            # Generate default steps from pose structure if no steps defined
            steps = self._generate_default_steps(pose_data)

        self.session = CoachSession(
            steps=steps,
            current_step_index=0,
            state=CoachState.GIVE_INSTRUCTION,
            pose_name=pose_data.get('name', pose_data.get('title', 'Unknown'))
        )

        logger.info(f"Coach started for pose '{self.session.pose_name}' with {len(steps)} steps")

        return self._give_current_instruction()

    def tick(self, landmarks: List[Dict]) -> Optional[Dict]:
        """
        Main update function. Call this every ~1 second with current landmarks.

        Args:
            landmarks: Current MediaPipe landmark data

        Returns:
            Dict with {action, message, state_update, debug_info} or None if no action needed
        """
        if not self.session or self.session.state == CoachState.IDLE:
            return None

        if self.session.state == CoachState.COMPLETE:
            return None

        current_time = time.time()
        progress = self.session.step_progress

        # Rate limit checks
        if current_time - progress.last_check_time < CHECK_INTERVAL:
            return None
        progress.last_check_time = current_time

        # Get current step - FIX: Bounds check BEFORE accessing
        if self.session.current_step_index >= len(self.session.steps):
            return self._complete_pose()

        step = self.session.steps[self.session.current_step_index]

        # ===== GIVE_INSTRUCTION State =====
        if self.session.state == CoachState.GIVE_INSTRUCTION:
            self.session.state = CoachState.WATCHING
            progress.watch_start_time = current_time
            progress.consecutive_passes = 0
            return self._give_current_instruction()

        # ===== WATCHING State =====
        if self.session.state == CoachState.WATCHING:
            # Check if step is complete
            check_result = self._check_landmark(landmarks, step)

            # Store debug info
            self.session.last_debug_info = check_result.get('debug_info')

            # Track for strict feedback
            self.session.last_check_passed = check_result['passed']

            if check_result['passed']:
                progress.consecutive_passes += 1
                logger.info(f"Step {self.session.current_step_index + 1} PASS {progress.consecutive_passes}/{PASS_THRESHOLD}")

                if progress.consecutive_passes >= PASS_THRESHOLD:
                    # Step confirmed! Track if correction was followed
                    if progress.attempts > 0:
                        self.session.corrections_followed += 1
                        logger.info(f"User followed correction! corrections_followed={self.session.corrections_followed}")
                    return self._confirm_step()
            else:
                # CRITICAL: Reset on ANY fail
                if progress.consecutive_passes > 0:
                    logger.info(f"Step {self.session.current_step_index + 1} FAIL - resetting consecutive passes from {progress.consecutive_passes} to 0")
                progress.consecutive_passes = 0

                # Check for "almost there" feedback
                if check_result.get('almost', False):
                    if current_time - progress.last_almost_time >= ALMOST_FEEDBACK_INTERVAL:
                        progress.last_almost_time = current_time
                        # Get feedback modifier for strict mode
                        feedback_mod = self.get_feedback_prompt_modifier()
                        return {
                            'action': 'almost',
                            'message': f"[COACH - ALMOST] {check_result.get('almost_message', 'Almost there! Just a little more.')}{feedback_mod}",
                            'state_update': self._get_state_update(),
                            'debug_info': self._format_debug_info()
                        }

            # Check for timeout
            watch_elapsed = current_time - progress.watch_start_time
            if watch_elapsed >= WATCH_TIMEOUT:
                return self._handle_timeout(landmarks, step)

        # ===== CONFIRMED State =====
        if self.session.state == CoachState.CONFIRMED:
            # Brief pause then advance
            return self._advance_to_next_step()

        return None

    def check_regression(self, landmarks: List[Dict]) -> Optional[Dict]:
        """
        Check if any completed steps have regressed (user moved out of position).

        FIX: Added cooldown and graceful handling of unknown check types.

        Returns:
            Warning message if regression detected, None otherwise
        """
        if not self.session or not self.session.completed_steps:
            return None

        # Cooldown check - don't spam regression warnings
        current_time = time.time()
        if current_time - self.session.last_regression_time < REGRESSION_COOLDOWN:
            return None

        for step_idx in self.session.completed_steps:
            step = self.session.steps[step_idx]
            result = self._check_landmark(landmarks, step)

            # FIX: Skip regression check for unknown check types or errors
            # Unknown types shouldn't trigger regression warnings
            if result.get('error') and 'Unknown check type' in result.get('error', ''):
                continue

            if not result['passed'] and not result.get('almost', False):
                instruction = step.get('instruction', 'previous position')
                self.session.last_regression_time = current_time  # Update cooldown
                return {
                    'action': 'regression',
                    'message': f"[COACH - REGRESSION] You've moved out of position! Hold your {instruction}",
                    'step_index': step_idx,
                    'state_update': self._get_state_update()
                }

        return None

    def get_current_step_info(self) -> Dict:
        """Get current step information for UI display"""
        if not self.session:
            return {'active': False}

        return {
            'active': True,
            'current_step': self.session.current_step_index + 1,
            'total_steps': len(self.session.steps),
            'state': self.session.state.value,
            'attempt': self.session.step_progress.attempts + 1,
            'instruction': self._get_current_instruction_text(),
            'pose_name': self.session.pose_name
        }

    def get_allowed_feedback_type(self) -> str:
        """
        Decide if AI can praise or must keep correcting.

        Returns:
            'correction_only': Do NOT praise. Only give the correction instruction.
            'neutral_confirm': Brief acknowledgment only ("OK", "Got it", "Next").
            'earned_praise': Can genuinely praise - user earned it.
        """
        if not self.session:
            return 'correction_only'

        # NEVER praise if current step is still failing
        if self.session.state == CoachState.WATCHING and not self.session.last_check_passed:
            return 'correction_only'

        # NEVER praise until user has followed at least 2 corrections
        if self.session.corrections_followed < 2:
            return 'neutral_confirm'

        # NEVER praise if more than 1 step still remains
        remaining = len(self.session.steps) - self.session.current_step_index
        if remaining > 1:
            return 'neutral_confirm'

        # Only allow genuine praise when pose is nearly complete
        return 'earned_praise'

    def get_feedback_prompt_modifier(self) -> str:
        """
        Get the prompt modifier based on allowed feedback type.
        This should be appended to any message sent to Gemini.
        """
        feedback_type = self.get_allowed_feedback_type()

        if feedback_type == 'correction_only':
            return "\nRULE: Do NOT praise. Only give the correction instruction. No 'great', 'perfect', 'amazing'."
        elif feedback_type == 'neutral_confirm':
            return "\nRULE: Brief acknowledgment only. Say 'OK' or 'Got it' or 'Next'. Do NOT say great/perfect/amazing/beautiful."
        elif feedback_type == 'earned_praise':
            return "\nYou can genuinely praise - they earned it!"
        return ""

    def _format_debug_info(self) -> Optional[Dict]:
        """Format debug info for frontend"""
        if not self.session or not self.session.last_debug_info:
            return None

        debug = self.session.last_debug_info
        return {
            'check_type': debug.check_type,
            'landmarks_used': debug.landmarks_used,
            'values': debug.values,
            'thresholds': debug.thresholds,
            'passed': debug.passed,
            'almost': debug.almost,
            'reason': debug.reason
        }

    # ============== INTERNAL METHODS ==============

    def _generate_default_steps(self, pose_data: Dict) -> List[Dict]:
        """Generate default steps from pose structure if none defined"""
        steps = []
        structure = pose_data.get('structure', {})

        # Step 1: Feet position
        feet = structure.get('feet', pose_data.get('feet', ''))
        if feet:
            steps.append({
                'instruction': f"Feet — position them {feet}",
                'landmark_check': {
                    'type': 'feet_position',
                    'description': feet
                },
                'alt_explanations': [
                    "Look down — check your foot placement matches the target",
                    "Shift your weight until your feet are in position",
                    "Ground yourself — feel stable before the next step"
                ],
                'common_mistakes': []
            })

        # Step 2: Body/torso
        steps.append({
            'instruction': "Shoulders — pull them down and back, away from your ears",
            'landmark_check': {
                'type': 'shoulders_level',
                'threshold': THRESHOLD_SHOULDERS_LEVEL
            },
            'alt_explanations': [
                "Shoulders — imagine squeezing a pencil between your shoulder blades",
                "Shoulders — exhale and let them drop 2 inches down",
                "Shoulders — roll them back in a small circle, then hold"
            ],
            'common_mistakes': [
                {'detect': 'shoulders_hunched', 'fix': 'Shoulders — drop them down, they are creeping up toward your ears'}
            ]
        })

        # Step 3: Hands position
        hands = structure.get('hands', pose_data.get('hands', ''))
        if hands:
            steps.append({
                'instruction': f"Hands — {hands}",
                'landmark_check': {
                    'type': 'hands_position',
                    'description': hands
                },
                'alt_explanations': [
                    "Arms — focus on moving them into position now",
                    "Hands — place them exactly where described",
                    "Wrists — check they're at the right height"
                ],
                'common_mistakes': []
            })

        # Step 4: Head position
        head = structure.get('head', pose_data.get('head', ''))
        if head:
            steps.append({
                'instruction': f"Head — {head}",
                'landmark_check': {
                    'type': 'head_position',
                    'description': head
                },
                'alt_explanations': [
                    "Chin — adjust it to match the target angle",
                    "Face — turn it toward the camera as described",
                    "Eyes — look in the direction specified"
                ],
                'common_mistakes': []
            })

        # Fallback if no structure - uses expression check with timeout
        if not steps:
            steps = [{
                'instruction': "Face — give a natural, relaxed expression",
                'landmark_check': {'type': 'expression'},
                'auto_advance_seconds': 8,  # Only for expression which can't be detected
                'alt_explanations': [
                    "Mouth — relax your jaw, slight smile",
                    "Eyes — soft gaze toward the camera"
                ],
                'common_mistakes': []
            }]

        return steps

    def _check_visibility(self, lm: Dict, indices: List[int]) -> Tuple[bool, List[str]]:
        """
        Check if all required landmarks are visible enough.

        Returns:
            (all_visible, list_of_invisible_landmarks)
        """
        invisible = []
        for idx in indices:
            if idx not in lm:
                invisible.append(f"landmark_{idx}_missing")
            elif lm[idx].get('v', lm[idx].get('visibility', 0)) < MIN_VISIBILITY:
                invisible.append(f"landmark_{idx}_low_vis({lm[idx].get('v', 0):.2f})")

        return len(invisible) == 0, invisible

    def _check_landmark(self, landmarks: List[Dict], step: Dict) -> Dict:
        """
        Check if landmarks match the step requirements.

        FIXED:
        - Visibility checks (landmarks < 0.5 visibility = FAIL)
        - Detailed logging for every check
        - Tightened thresholds
        - NO auto-pass fallback for undefined checks

        Returns:
            {passed: bool, almost: bool, almost_message: str, error: str, debug_info: DebugInfo}
        """
        debug = DebugInfo()

        if not landmarks or len(landmarks) < 33:
            debug.reason = "No landmarks detected or < 33 points"
            logger.warning(f"CHECK FAIL: {debug.reason}")
            return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

        lm = {item['idx']: item for item in landmarks}
        check = step.get('landmark_check', {})
        check_type = check.get('type', 'unknown')
        debug.check_type = check_type

        # ===== EXPRESSION CHECK (uses timeout, not landmarks) =====
        if check_type == 'expression':
            auto_advance = step.get('auto_advance_seconds', 8)
            debug.reason = f"Expression check - uses timeout ({auto_advance}s), not landmarks"
            debug.passed = False  # Never auto-pass, let timeout handle it
            logger.info(f"CHECK expression: waiting for timeout (auto_advance={auto_advance}s)")
            return {'passed': False, 'almost': False, 'debug_info': debug}

        # ===== SHOULDERS LEVEL CHECK =====
        if check_type == 'shoulders_level':
            required = [11, 12]  # left_shoulder, right_shoulder
            visible, missing = self._check_visibility(lm, required)
            debug.landmarks_used = ['left_shoulder(11)', 'right_shoulder(12)']

            if not visible:
                debug.reason = f"Landmarks not visible: {missing}"
                logger.warning(f"CHECK shoulders_level FAIL: {debug.reason}")
                return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

            threshold = check.get('threshold', THRESHOLD_SHOULDERS_LEVEL)
            l_shoulder_y = lm[11]['y']
            r_shoulder_y = lm[12]['y']
            diff = abs(l_shoulder_y - r_shoulder_y)

            debug.values = {'left_shoulder_y': l_shoulder_y, 'right_shoulder_y': r_shoulder_y, 'diff': diff}
            debug.thresholds = {'max_diff': threshold, 'almost_max': threshold * ALMOST_THRESHOLD}

            log_msg = f"CHECK shoulders_level: L_y={l_shoulder_y:.3f} R_y={r_shoulder_y:.3f} diff={diff:.3f} threshold={threshold:.3f}"

            if diff <= threshold:
                debug.passed = True
                debug.reason = "Shoulders are level"
                logger.info(f"{log_msg} -> PASS")
                return {'passed': True, 'debug_info': debug}
            elif diff <= threshold * ALMOST_THRESHOLD:
                debug.almost = True
                debug.reason = f"Almost level (diff={diff:.3f}, need <{threshold:.3f})"
                logger.info(f"{log_msg} -> ALMOST")
                return {'passed': False, 'almost': True,
                        'almost_message': f"Shoulders almost level — drop the higher one slightly",
                        'debug_info': debug}
            else:
                higher = "left" if l_shoulder_y < r_shoulder_y else "right"
                debug.reason = f"Shoulders not level ({higher} is higher by {diff:.3f})"
                logger.info(f"{log_msg} -> FAIL ({higher} higher)")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

        # ===== HANDS POSITION CHECK =====
        if check_type == 'hands_position':
            desc = check.get('description', '').lower()
            debug.landmarks_used = ['left_wrist(15)', 'right_wrist(16)', 'left_hip(23)', 'right_hip(24)']

            # --- HAND ON HIP/WAIST ---
            if 'waist' in desc or 'hip' in desc:
                required = [15, 16, 23, 24]
                visible, missing = self._check_visibility(lm, required)

                if not visible:
                    debug.reason = f"Landmarks not visible: {missing}"
                    logger.warning(f"CHECK hands_on_hip FAIL: {debug.reason}")
                    return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

                l_wrist, r_wrist = lm[15], lm[16]
                l_hip, r_hip = lm[23], lm[24]
                hip_y = (l_hip['y'] + r_hip['y']) / 2

                # Calculate distances for each hand to its respective hip
                l_dist_y = abs(l_wrist['y'] - hip_y)
                l_dist_x = abs(l_wrist['x'] - l_hip['x'])
                r_dist_y = abs(r_wrist['y'] - hip_y)
                r_dist_x = abs(r_wrist['x'] - r_hip['x'])

                # Euclidean distance
                l_dist = math.sqrt(l_dist_y**2 + l_dist_x**2)
                r_dist = math.sqrt(r_dist_y**2 + r_dist_x**2)

                debug.values = {
                    'left_wrist': f"({l_wrist['x']:.3f}, {l_wrist['y']:.3f})",
                    'right_wrist': f"({r_wrist['x']:.3f}, {r_wrist['y']:.3f})",
                    'left_hip': f"({l_hip['x']:.3f}, {l_hip['y']:.3f})",
                    'right_hip': f"({r_hip['x']:.3f}, {r_hip['y']:.3f})",
                    'hip_y_mid': hip_y,
                    'left_dist': l_dist,
                    'right_dist': r_dist
                }
                debug.thresholds = {
                    'max_y_diff': THRESHOLD_HAND_ON_HIP_Y,
                    'max_x_diff': THRESHOLD_HAND_ON_HIP_X,
                    'max_dist': THRESHOLD_HAND_ON_HIP_DIST
                }

                # Check if at least one hand is on hip
                l_on_hip = l_dist_y < THRESHOLD_HAND_ON_HIP_Y and l_dist_x < THRESHOLD_HAND_ON_HIP_X
                r_on_hip = r_dist_y < THRESHOLD_HAND_ON_HIP_Y and r_dist_x < THRESHOLD_HAND_ON_HIP_X

                log_msg = f"CHECK hand_on_hip: L_wrist({l_wrist['x']:.2f},{l_wrist['y']:.2f}) L_hip({l_hip['x']:.2f},{l_hip['y']:.2f}) L_dist={l_dist:.3f} | R_wrist({r_wrist['x']:.2f},{r_wrist['y']:.2f}) R_hip({r_hip['x']:.2f},{r_hip['y']:.2f}) R_dist={r_dist:.3f}"

                if l_on_hip or r_on_hip:
                    which = "left" if l_on_hip else "right"
                    debug.passed = True
                    debug.reason = f"{which.capitalize()} hand is on hip"
                    logger.info(f"{log_msg} -> PASS ({which})")
                    return {'passed': True, 'debug_info': debug}

                # Almost there check (looser thresholds)
                l_almost = l_dist_y < THRESHOLD_HAND_ON_HIP_Y * 1.5 and l_dist_x < THRESHOLD_HAND_ON_HIP_X * 1.5
                r_almost = r_dist_y < THRESHOLD_HAND_ON_HIP_Y * 1.5 and r_dist_x < THRESHOLD_HAND_ON_HIP_X * 1.5

                if l_almost or r_almost:
                    which = "Left" if l_almost else "Right"
                    debug.almost = True
                    debug.reason = f"{which} hand is close to hip"
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': f"{which} hand — move it a bit closer to your hip bone",
                            'debug_info': debug}

                debug.reason = f"Neither hand is on hip (L_dist={l_dist:.3f}, R_dist={r_dist:.3f})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- RELAXED/DOWN HANDS ---
            if 'relax' in desc or 'down' in desc or 'side' in desc:
                required = [15, 16]
                visible, missing = self._check_visibility(lm, required)

                if not visible:
                    debug.reason = f"Landmarks not visible: {missing}"
                    logger.warning(f"CHECK hands_relaxed FAIL: {debug.reason}")
                    return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

                l_wrist_y = lm[15]['y']
                r_wrist_y = lm[16]['y']

                debug.values = {'left_wrist_y': l_wrist_y, 'right_wrist_y': r_wrist_y}
                debug.thresholds = {'min_y': THRESHOLD_ARMS_DOWN}

                log_msg = f"CHECK hands_relaxed: L_wrist_y={l_wrist_y:.3f} R_wrist_y={r_wrist_y:.3f} threshold={THRESHOLD_ARMS_DOWN}"

                if l_wrist_y > THRESHOLD_ARMS_DOWN and r_wrist_y > THRESHOLD_ARMS_DOWN:
                    debug.passed = True
                    debug.reason = "Both arms are down/relaxed"
                    logger.info(f"{log_msg} -> PASS")
                    return {'passed': True, 'debug_info': debug}
                elif l_wrist_y > THRESHOLD_ARMS_DOWN - 0.1 or r_wrist_y > THRESHOLD_ARMS_DOWN - 0.1:
                    debug.almost = True
                    debug.reason = "Arms almost down"
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Arms — let them drop a bit more, completely relaxed",
                            'debug_info': debug}

                debug.reason = f"Arms not relaxed (L_y={l_wrist_y:.3f}, R_y={r_wrist_y:.3f}, need >{THRESHOLD_ARMS_DOWN})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- ELBOW BACK ---
            if 'elbow' in desc and 'back' in desc:
                required = [11, 12, 13, 14]  # shoulders and elbows
                visible, missing = self._check_visibility(lm, required)

                if not visible:
                    debug.reason = f"Landmarks not visible: {missing}"
                    return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

                l_shoulder_x = lm[11]['x']
                r_shoulder_x = lm[12]['x']
                l_elbow_x = lm[13]['x']
                r_elbow_x = lm[14]['x']

                # Elbow should be behind (greater x for left, lesser x for right in mirrored view)
                # In normalized coords, we check if elbow extends outward
                l_diff = l_elbow_x - l_shoulder_x  # Should be negative (elbow to the left)
                r_diff = r_shoulder_x - r_elbow_x  # Should be negative (elbow to the right)

                debug.values = {'l_shoulder_x': l_shoulder_x, 'l_elbow_x': l_elbow_x, 'l_diff': l_diff,
                               'r_shoulder_x': r_shoulder_x, 'r_elbow_x': r_elbow_x, 'r_diff': r_diff}
                debug.thresholds = {'min_diff': THRESHOLD_ELBOW_BACK}

                # At least one elbow should be pushed back/out
                if abs(l_diff) > THRESHOLD_ELBOW_BACK or abs(r_diff) > THRESHOLD_ELBOW_BACK:
                    debug.passed = True
                    logger.info(f"CHECK elbow_back: L_diff={l_diff:.3f} R_diff={r_diff:.3f} -> PASS")
                    return {'passed': True, 'debug_info': debug}

                debug.reason = f"Elbows not back enough"
                logger.info(f"CHECK elbow_back: L_diff={l_diff:.3f} R_diff={r_diff:.3f} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- HANDS UP / ABOVE HEAD / HAIR (FIX for Bug 1) ---
            if 'up' in desc or 'hair' in desc or 'above' in desc or 'head' in desc:
                required = [11, 12, 15, 16]  # shoulders and wrists
                visible, missing = self._check_visibility(lm, required)
                debug.landmarks_used = ['left_shoulder(11)', 'right_shoulder(12)', 'left_wrist(15)', 'right_wrist(16)']

                if not visible:
                    debug.reason = f"Landmarks not visible: {missing}"
                    logger.warning(f"CHECK hands_up FAIL: {debug.reason}")
                    return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

                l_shoulder_y = lm[11]['y']
                r_shoulder_y = lm[12]['y']
                l_wrist_y = lm[15]['y']
                r_wrist_y = lm[16]['y']
                shoulder_avg_y = (l_shoulder_y + r_shoulder_y) / 2

                # In normalized coords, lower y = higher position
                # Wrists should be above shoulders (wrist_y < shoulder_y)
                l_above = l_wrist_y < l_shoulder_y
                r_above = r_wrist_y < r_shoulder_y

                debug.values = {
                    'left_wrist_y': l_wrist_y,
                    'right_wrist_y': r_wrist_y,
                    'left_shoulder_y': l_shoulder_y,
                    'right_shoulder_y': r_shoulder_y,
                    'shoulder_avg_y': shoulder_avg_y
                }
                debug.thresholds = {'wrist_y_must_be_less_than': shoulder_avg_y}

                log_msg = f"CHECK hands_up: L_wrist_y={l_wrist_y:.3f} R_wrist_y={r_wrist_y:.3f} shoulder_avg_y={shoulder_avg_y:.3f}"

                if l_above and r_above:
                    debug.passed = True
                    debug.reason = "Both hands are above shoulders"
                    logger.info(f"{log_msg} -> PASS (both above)")
                    return {'passed': True, 'debug_info': debug}
                elif l_above or r_above:
                    which = "Left" if l_above else "Right"
                    other = "right" if l_above else "left"
                    debug.almost = True
                    debug.reason = f"{which} hand is up, {other} needs to go higher"
                    logger.info(f"{log_msg} -> ALMOST ({which} above)")
                    return {'passed': False, 'almost': True,
                            'almost_message': f"{other.capitalize()} hand - raise it above your shoulder",
                            'debug_info': debug}

                # Check if close to shoulder level
                l_close = l_wrist_y < shoulder_avg_y + 0.1
                r_close = r_wrist_y < shoulder_avg_y + 0.1
                if l_close or r_close:
                    debug.almost = True
                    debug.reason = "Hands almost at shoulder level"
                    logger.info(f"{log_msg} -> ALMOST (close)")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Hands - raise them a bit higher, above your shoulders",
                            'debug_info': debug}

                debug.reason = f"Hands not raised (L_y={l_wrist_y:.3f}, R_y={r_wrist_y:.3f}, need < shoulder_y={shoulder_avg_y:.3f})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

        # ===== HEAD POSITION CHECK =====
        if check_type == 'head_position':
            desc = check.get('description', '').lower()
            debug.landmarks_used = ['nose(0)', 'left_shoulder(11)', 'right_shoulder(12)']

            required = [0]  # nose
            visible, missing = self._check_visibility(lm, required)

            if not visible:
                debug.reason = f"Landmarks not visible: {missing}"
                logger.warning(f"CHECK head_position FAIL: {debug.reason}")
                return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

            nose = lm[0]
            nose_x, nose_y = nose['x'], nose['y']

            # --- CHIN UP/ELEVATED ---
            if 'up' in desc or 'high' in desc or 'lift' in desc or 'elevat' in desc:
                # Need shoulders to compare
                shoulder_required = [11, 12]
                shoulder_visible, _ = self._check_visibility(lm, shoulder_required)

                if shoulder_visible:
                    shoulder_mid_y = (lm[11]['y'] + lm[12]['y']) / 2
                    chin_elevation = shoulder_mid_y - nose_y  # Positive = nose above shoulders

                    debug.values = {'nose_y': nose_y, 'shoulder_mid_y': shoulder_mid_y, 'elevation': chin_elevation}
                    debug.thresholds = {'min_elevation': THRESHOLD_CHIN_ELEVATED}

                    log_msg = f"CHECK chin_up: nose_y={nose_y:.3f} shoulder_mid_y={shoulder_mid_y:.3f} elevation={chin_elevation:.3f} threshold={THRESHOLD_CHIN_ELEVATED}"

                    if chin_elevation > THRESHOLD_CHIN_ELEVATED:
                        debug.passed = True
                        debug.reason = "Chin is elevated"
                        logger.info(f"{log_msg} -> PASS")
                        return {'passed': True, 'debug_info': debug}
                    elif chin_elevation > THRESHOLD_CHIN_ELEVATED * 0.5:
                        debug.almost = True
                        debug.reason = "Chin almost high enough"
                        logger.info(f"{log_msg} -> ALMOST")
                        return {'passed': False, 'almost': True,
                                'almost_message': "Chin — lift it just a tiny bit more, like looking at the top of a doorframe",
                                'debug_info': debug}

                    debug.reason = f"Chin not elevated enough (elevation={chin_elevation:.3f}, need >{THRESHOLD_CHIN_ELEVATED})"
                    logger.info(f"{log_msg} -> FAIL")
                    return {'passed': False, 'error': debug.reason, 'debug_info': debug}
                else:
                    # Fallback to absolute position if shoulders not visible
                    debug.values = {'nose_y': nose_y}
                    debug.thresholds = {'max_nose_y': 0.35}

                    if nose_y < 0.35:
                        debug.passed = True
                        return {'passed': True, 'debug_info': debug}
                    elif nose_y < 0.40:
                        return {'passed': False, 'almost': True,
                                'almost_message': "Chin — lift it slightly higher",
                                'debug_info': debug}
                    return {'passed': False, 'error': 'Chin not lifted', 'debug_info': debug}

            # --- HEAD TILT/TURN ---
            if 'tilt' in desc or 'turn' in desc or 'angle' in desc:
                deviation_from_center = abs(nose_x - 0.5)

                debug.values = {'nose_x': nose_x, 'center': 0.5, 'deviation': deviation_from_center}
                debug.thresholds = {'min_deviation': THRESHOLD_HEAD_TILT}

                log_msg = f"CHECK head_tilt: nose_x={nose_x:.3f} deviation_from_center={deviation_from_center:.3f} threshold={THRESHOLD_HEAD_TILT}"

                if deviation_from_center > THRESHOLD_HEAD_TILT:
                    direction = "left" if nose_x < 0.5 else "right"
                    debug.passed = True
                    debug.reason = f"Head tilted {direction}"
                    logger.info(f"{log_msg} -> PASS (turned {direction})")
                    return {'passed': True, 'debug_info': debug}
                elif deviation_from_center > THRESHOLD_HEAD_TILT * 0.6:
                    debug.almost = True
                    debug.reason = "Head almost tilted enough"
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Head — turn it just a bit more to the side",
                            'debug_info': debug}

                debug.reason = f"Head not tilted (deviation={deviation_from_center:.3f}, need >{THRESHOLD_HEAD_TILT})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- STRAIGHT/LEVEL HEAD ---
            if 'straight' in desc or 'level' in desc or 'forward' in desc:
                deviation_from_center = abs(nose_x - 0.5)

                debug.values = {'nose_x': nose_x, 'deviation': deviation_from_center}
                debug.thresholds = {'max_deviation': 0.06}

                log_msg = f"CHECK head_straight: nose_x={nose_x:.3f} deviation={deviation_from_center:.3f}"

                if deviation_from_center < 0.06:
                    debug.passed = True
                    debug.reason = "Head is straight/centered"
                    logger.info(f"{log_msg} -> PASS")
                    return {'passed': True, 'debug_info': debug}
                elif deviation_from_center < 0.10:
                    direction = "left" if nose_x < 0.5 else "right"
                    debug.almost = True
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': f"Head — center it a bit more, turn slightly {direction}",
                            'debug_info': debug}

                debug.reason = f"Head not centered"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

        # ===== FEET POSITION CHECK =====
        if check_type == 'feet_position':
            desc = check.get('description', '').lower()
            debug.landmarks_used = ['left_ankle(27)', 'right_ankle(28)']

            required = [27, 28]
            visible, missing = self._check_visibility(lm, required)

            if not visible:
                debug.reason = f"Landmarks not visible: {missing}"
                logger.warning(f"CHECK feet_position FAIL: {debug.reason}")
                return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

            l_ankle = lm[27]
            r_ankle = lm[28]
            feet_width = abs(l_ankle['x'] - r_ankle['x'])

            debug.values = {'left_ankle_x': l_ankle['x'], 'right_ankle_x': r_ankle['x'], 'feet_width': feet_width}

            # --- FEET TOGETHER ---
            if 'together' in desc or 'close' in desc:
                debug.thresholds = {'max_width': THRESHOLD_FEET_TOGETHER}
                log_msg = f"CHECK feet_together: width={feet_width:.3f} threshold={THRESHOLD_FEET_TOGETHER}"

                if feet_width < THRESHOLD_FEET_TOGETHER:
                    debug.passed = True
                    debug.reason = "Feet are together"
                    logger.info(f"{log_msg} -> PASS")
                    return {'passed': True, 'debug_info': debug}
                elif feet_width < THRESHOLD_FEET_TOGETHER * 1.5:
                    debug.almost = True
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Feet — bring them a bit closer together",
                            'debug_info': debug}

                debug.reason = f"Feet too far apart (width={feet_width:.3f}, need <{THRESHOLD_FEET_TOGETHER})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- FEET APART/WIDE ---
            if 'apart' in desc or 'wide' in desc or 'shoulder' in desc or 'spread' in desc:
                debug.thresholds = {'min_width': THRESHOLD_FEET_APART}
                log_msg = f"CHECK feet_apart: width={feet_width:.3f} threshold={THRESHOLD_FEET_APART}"

                if feet_width > THRESHOLD_FEET_APART:
                    debug.passed = True
                    debug.reason = "Feet are apart"
                    logger.info(f"{log_msg} -> PASS")
                    return {'passed': True, 'debug_info': debug}
                elif feet_width > THRESHOLD_FEET_APART * 0.7:
                    debug.almost = True
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Feet — spread them a bit wider apart",
                            'debug_info': debug}

                debug.reason = f"Feet too close (width={feet_width:.3f}, need >{THRESHOLD_FEET_APART})"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

            # --- ONE FOOT FORWARD (staggered stance) ---
            if 'forward' in desc or 'stagger' in desc or 'step' in desc:
                feet_y_diff = abs(l_ankle['y'] - r_ankle['y'])
                debug.values['feet_y_diff'] = feet_y_diff
                debug.thresholds = {'min_y_diff': 0.03}

                log_msg = f"CHECK feet_staggered: y_diff={feet_y_diff:.3f}"

                if feet_y_diff > 0.03:
                    front = "left" if l_ankle['y'] > r_ankle['y'] else "right"
                    debug.passed = True
                    debug.reason = f"{front.capitalize()} foot is forward"
                    logger.info(f"{log_msg} -> PASS ({front} forward)")
                    return {'passed': True, 'debug_info': debug}
                elif feet_y_diff > 0.015:
                    debug.almost = True
                    logger.info(f"{log_msg} -> ALMOST")
                    return {'passed': False, 'almost': True,
                            'almost_message': "Feet — step one foot a bit more forward",
                            'debug_info': debug}

                debug.reason = f"Feet not staggered (y_diff={feet_y_diff:.3f}, need >0.03)"
                logger.info(f"{log_msg} -> FAIL")
                return {'passed': False, 'error': debug.reason, 'debug_info': debug}

        # ===== UNKNOWN CHECK TYPE - FAIL (not auto-pass!) =====
        debug.reason = f"Unknown check type: {check_type} - cannot verify"
        logger.warning(f"CHECK {check_type} FAIL: Unknown check type, no auto-pass")
        return {'passed': False, 'almost': False, 'error': debug.reason, 'debug_info': debug}

    def _get_correction(self, landmarks: List[Dict], step: Dict) -> str:
        """Get specific correction based on what's wrong"""
        check_result = self._check_landmark(landmarks, step)

        # Check common mistakes first
        common_mistakes = step.get('common_mistakes', [])
        for mistake in common_mistakes:
            detect_type = mistake.get('detect', '')
            if detect_type and self._detect_mistake(landmarks, detect_type):
                return mistake.get('fix', 'Adjust your position')

        # Generic correction based on error
        error = check_result.get('error', '')
        if error:
            return f"Try again: {error}"

        return "Let's try that again. Focus on the movement."

    def _detect_mistake(self, landmarks: List[Dict], mistake_type: str) -> bool:
        """Detect specific common mistakes"""
        if not landmarks:
            return False

        lm = {item['idx']: item for item in landmarks}

        if mistake_type == 'shoulders_hunched':
            if 11 in lm and 12 in lm:
                # Shoulders hunched if they're high relative to ears
                if 7 in lm and 8 in lm:
                    ear_y = (lm[7]['y'] + lm[8]['y']) / 2
                    shoulder_y = (lm[11]['y'] + lm[12]['y']) / 2
                    return shoulder_y < ear_y + 0.08  # Shoulders too high

        return False

    def _get_alt_explanation(self, step: Dict) -> str:
        """Get next alternative explanation from the list"""
        alt_list = step.get('alt_explanations', [])
        if not alt_list:
            return step.get('instruction', 'Try again')

        idx = self.session.step_progress.alt_explanation_index
        explanation = alt_list[idx % len(alt_list)]
        self.session.step_progress.alt_explanation_index += 1

        return explanation

    def _give_current_instruction(self) -> Dict:
        """Generate instruction message for current step"""
        # FIX: Bounds check
        if self.session.current_step_index >= len(self.session.steps):
            return self._complete_pose()

        step = self.session.steps[self.session.current_step_index]
        step_num = self.session.current_step_index + 1
        total = len(self.session.steps)
        instruction = step.get('instruction', 'Strike the pose')

        return {
            'action': 'instruction',
            'message': f"[COACH - STEP {step_num}/{total}] {instruction}",
            'state_update': self._get_state_update(),
            'debug_info': self._format_debug_info()
        }

    def _get_current_instruction_text(self) -> str:
        """Get just the instruction text for current step"""
        if not self.session or self.session.current_step_index >= len(self.session.steps):
            return ""
        step = self.session.steps[self.session.current_step_index]
        return step.get('instruction', '')

    def _confirm_step(self) -> Dict:
        """Handle step confirmation with strict feedback rules"""
        self.session.state = CoachState.CONFIRMED
        self.session.completed_steps.append(self.session.current_step_index)

        step_num = self.session.current_step_index + 1
        total = len(self.session.steps)

        logger.info(f"Step {step_num}/{total} CONFIRMED!")

        # Use strict feedback rules
        feedback_type = self.get_allowed_feedback_type()
        feedback_mod = self.get_feedback_prompt_modifier()

        if feedback_type == 'earned_praise':
            # Near end, can praise
            message = f"[COACH - STEP COMPLETE] Perfect! Step {step_num} done. Hold it!"
        else:
            # Neutral confirmation only
            message = f"[COACH - STEP COMPLETE] OK, step {step_num} done. Next.{feedback_mod}"

        return {
            'action': 'confirmed',
            'message': message,
            'state_update': self._get_state_update(),
            'debug_info': self._format_debug_info()
        }

    def _advance_to_next_step(self) -> Optional[Dict]:
        """Move to the next step"""
        self.session.current_step_index += 1
        self.session.step_progress = StepProgress()  # Reset progress

        # FIX: Check bounds AFTER increment
        if self.session.current_step_index >= len(self.session.steps):
            return self._complete_pose()

        self.session.state = CoachState.GIVE_INSTRUCTION
        return self._give_current_instruction()

    def _handle_timeout(self, landmarks: List[Dict], step: Dict) -> Dict:
        """Handle when user times out on a step"""
        progress = self.session.step_progress
        progress.attempts += 1

        step_num = self.session.current_step_index + 1

        # Check for auto_advance (only for expression checks)
        auto_advance = step.get('auto_advance_seconds')
        if auto_advance and step.get('landmark_check', {}).get('type') == 'expression':
            logger.info(f"Expression step {step_num} auto-advancing after timeout")
            return self._advance_to_next_step()

        if progress.attempts >= MAX_ATTEMPTS:
            # Move on after max attempts
            logger.warning(f"Max attempts reached for step {step_num}, moving on")
            return self._advance_to_next_step()

        # Reset watching state
        self.session.state = CoachState.GIVE_INSTRUCTION
        progress.watch_start_time = time.time()
        progress.consecutive_passes = 0

        # Track correction given
        self.session.corrections_given += 1
        logger.info(f"Correction given! corrections_given={self.session.corrections_given}")

        # Get correction or alt explanation with strict feedback modifier
        feedback_mod = self.get_feedback_prompt_modifier()
        if progress.attempts <= 2:
            correction = self._get_correction(landmarks, step)
            message = f"[COACH - TRY AGAIN] {correction}{feedback_mod}"
        else:
            alt = self._get_alt_explanation(step)
            message = f"[COACH - LET ME EXPLAIN DIFFERENTLY] {alt}{feedback_mod}"

        return {
            'action': 'retry',
            'message': message,
            'attempt': progress.attempts,
            'state_update': self._get_state_update(),
            'debug_info': self._format_debug_info()
        }

    def _complete_pose(self) -> Dict:
        """Handle pose completion"""
        self.session.state = CoachState.COMPLETE

        logger.info(f"Pose '{self.session.pose_name}' COMPLETED!")

        return {
            'action': 'complete',
            'message': f"[COACH - POSE COMPLETE] Amazing! You've nailed the entire pose! Hold it for the photo!",
            'state_update': self._get_state_update(),
            'debug_info': self._format_debug_info()
        }

    def _get_state_update(self) -> Dict:
        """Get state update for frontend"""
        if not self.session:
            return {'active': False}

        return {
            'active': True,
            'current_step': self.session.current_step_index + 1,
            'total_steps': len(self.session.steps),
            'state': self.session.state.value,
            'attempt': self.session.step_progress.attempts + 1,
            'completed_steps': self.session.completed_steps.copy()
        }
