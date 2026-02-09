"""
Pose Database

Stores pose definitions including step-by-step instructions for coach mode.
Each pose can have a 'steps' array for sequential coaching.

FIXED: All instructions now follow the formula:
  [WHAT body part] + [WHICH DIRECTION] + [WHAT action]
"""

from typing import Dict, Optional, List
import json
import logging

logger = logging.getLogger("mcai-pose-db")

# In-memory database (can migrate to Redis/PostgreSQL later)
POSE_DATABASE: Dict[str, Dict] = {}


# ============== EXAMPLE POSES WITH SPECIFIC DIRECTIONAL STEPS ==============
# Instructions follow: [BODY PART] — [DIRECTION] + [ACTION]

EXAMPLE_POSES = {
    "confident-stance": {
        "id": "confident-stance",
        "title": "Confident Power Stance",
        "description": "Front view, chest level",
        "structure": {
            "head": "Chin — lift it up slightly, eyes forward to camera",
            "hands": "Right hand — place it on your right hip, elbow pointing out",
            "feet": "Feet — spread them shoulder-width apart, weight even"
        },
        "tips": ["Stand tall", "Shoulders back", "Slight smile"],
        "steps": [
            {
                "instruction": "Feet — spread them apart to shoulder width, like standing on train tracks",
                "landmark_check": {
                    "type": "feet_position",
                    "description": "shoulder width apart spread"
                },
                "alt_explanations": [
                    "Feet — look down, they should be directly under your shoulders",
                    "Feet — imagine a line from each shoulder dropping straight down to your feet",
                    "Feet — step your left foot left and right foot right until hip-width"
                ],
                "common_mistakes": [
                    {"detect": "feet_too_close", "fix": "Feet — step them wider apart, about hip-width"}
                ]
            },
            {
                "instruction": "Shoulders — pull them down away from your ears, then back like squeezing a pencil between your shoulder blades",
                "landmark_check": {
                    "type": "shoulders_level",
                    "threshold": 0.04
                },
                "alt_explanations": [
                    "Shoulders — exhale and drop them 2 inches down, roll them back",
                    "Shoulders — imagine someone pushing down gently on top of each shoulder",
                    "Shoulders — pretend you're wearing a heavy backpack — let them sink down and back"
                ],
                "common_mistakes": [
                    {"detect": "shoulders_hunched", "fix": "Shoulders — they're creeping up toward your ears, drop them down"}
                ]
            },
            {
                "instruction": "Right hand — bring it to your right hip bone, elbow pointing out to the side",
                "landmark_check": {
                    "type": "hands_position",
                    "description": "hand on hip waist"
                },
                "alt_explanations": [
                    "Right wrist — place it where your waist curves in, thumb forward, fingers on your lower back",
                    "Right elbow — push it out to the side like you're making room in a crowd",
                    "Right hand — find your hip bone with your fingers, rest your palm there"
                ],
                "common_mistakes": [
                    {"detect": "hand_too_high", "fix": "Right hand — slide it down to your hip, not your ribs"}
                ]
            },
            {
                "instruction": "Chin — lift it up slightly, like looking at the top of a doorframe, eyes straight at camera",
                "landmark_check": {
                    "type": "head_position",
                    "description": "chin up elevated lift"
                },
                "alt_explanations": [
                    "Chin — imagine someone called your name from slightly above eye level",
                    "Chin — push it forward and up, like a turtle coming out of its shell",
                    "Face — look at a point 6 inches above the camera lens"
                ],
                "common_mistakes": [
                    {"detect": "chin_too_high", "fix": "Chin — lower it a bit, you're looking too far up at the ceiling"}
                ]
            }
        ]
    },
    "relaxed-casual": {
        "id": "relaxed-casual",
        "title": "Relaxed Casual",
        "description": "3/4 angle, natural light",
        "structure": {
            "head": "Head — tilt it slightly to your right, chin level",
            "hands": "Arms — let them hang down by your sides, fingers relaxed",
            "feet": "Left foot — step it forward slightly, weight on back foot"
        },
        "tips": ["Stay loose", "Natural smile", "Weight on back foot"],
        "steps": [
            {
                "instruction": "Left foot — step it forward about 6 inches, keep your weight on your back (right) foot",
                "landmark_check": {
                    "type": "feet_position",
                    "description": "one foot forward staggered step"
                },
                "alt_explanations": [
                    "Left foot — slide it forward like you're about to take a slow step but stopped mid-stride",
                    "Right foot — keep it planted, shift your weight onto it, left foot just touches lightly",
                    "Feet — imagine you're standing in a queue, one foot slightly ahead"
                ],
                "common_mistakes": []
            },
            {
                "instruction": "Arms — shake them out, then let them drop completely by your sides, fingers loose",
                "landmark_check": {
                    "type": "hands_position",
                    "description": "relaxed down by sides"
                },
                "alt_explanations": [
                    "Arms — pretend they're made of heavy rope, let gravity pull them down",
                    "Hands — curl your fingers slightly like you're holding invisible tennis balls",
                    "Wrists — rotate them so palms face your thighs, completely relaxed"
                ],
                "common_mistakes": [
                    {"detect": "arms_stiff", "fix": "Arms — shake them out again, they look stiff, let them hang loose"}
                ]
            },
            {
                "instruction": "Head — tilt it slightly to your right, like you're curious about something",
                "landmark_check": {
                    "type": "head_position",
                    "description": "slight tilt angle turn"
                },
                "alt_explanations": [
                    "Head — drop your right ear toward your right shoulder, just a little",
                    "Chin — keep it level but rotate your head slightly right",
                    "Face — turn it 10 degrees to your right, like looking at something just off-camera"
                ],
                "common_mistakes": []
            }
        ]
    },
    "hands-on-hips": {
        "id": "hands-on-hips",
        "title": "Power Pose - Hands on Hips",
        "description": "Front facing, full body",
        "structure": {
            "head": "Chin — keep it level, eyes straight at camera",
            "hands": "Both hands — place them on your hips, elbows wide",
            "feet": "Feet — spread them wider than shoulder-width, grounded"
        },
        "tips": ["Project confidence", "Take up space", "Strong eye contact"],
        "steps": [
            {
                "instruction": "Feet — spread them wider than your shoulders, plant them firmly like a superhero",
                "landmark_check": {
                    "type": "feet_position",
                    "description": "wide apart spread"
                },
                "alt_explanations": [
                    "Feet — step each foot out another 6 inches, take up more space",
                    "Feet — imagine you're standing on a wide balance beam, feet at each edge",
                    "Legs — straighten them, feel grounded and powerful"
                ],
                "common_mistakes": []
            },
            {
                "instruction": "Shoulders — exhale and drop them down, then roll them back so your chest opens up",
                "landmark_check": {
                    "type": "shoulders_level",
                    "threshold": 0.04
                },
                "alt_explanations": [
                    "Shoulders — imagine a weight on each one pulling them down toward the floor",
                    "Chest — push it forward slightly as your shoulders move back",
                    "Shoulders — make them level, left and right the same height"
                ],
                "common_mistakes": [
                    {"detect": "shoulders_hunched", "fix": "Shoulders — they're tensed up, breathe out and let them fall"}
                ]
            },
            {
                "instruction": "Both hands — place them on your hip bones, thumbs forward, elbows pointing out wide to the sides",
                "landmark_check": {
                    "type": "hands_position",
                    "description": "both hands on hips waist"
                },
                "alt_explanations": [
                    "Elbows — push them out to the sides like you're making yourself wider",
                    "Wrists — rest them where your waist meets your hips",
                    "Hands — classic superhero pose, fingers wrap around to your lower back"
                ],
                "common_mistakes": []
            },
            {
                "instruction": "Chin — keep it level, not up or down, eyes looking straight into the camera lens",
                "landmark_check": {
                    "type": "head_position",
                    "description": "straight level forward"
                },
                "alt_explanations": [
                    "Face — look directly at the camera like you're looking at someone eye-to-eye",
                    "Chin — imagine a level bubble sitting on it, keep it balanced",
                    "Head — don't tilt it, face straight ahead at the lens"
                ],
                "common_mistakes": []
            }
        ]
    }
}


def add_pose(pose_id: str, pose_data: Dict) -> None:
    """Add or update a pose in the database"""
    POSE_DATABASE[pose_id] = {"id": pose_id, **pose_data}
    logger.info(f"Pose added/updated: {pose_id} - {pose_data.get('title')}")


def get_pose(pose_id: str) -> Optional[Dict]:
    """Get a pose by ID"""
    return POSE_DATABASE.get(pose_id)


def list_all_poses() -> List[Dict]:
    """List all poses in the database"""
    return list(POSE_DATABASE.values())


def delete_pose(pose_id: str) -> bool:
    """Delete a pose by ID"""
    if pose_id in POSE_DATABASE:
        del POSE_DATABASE[pose_id]
        logger.info(f"Pose deleted: {pose_id}")
        return True
    return False


def get_pose_with_steps(pose_id: str) -> Optional[Dict]:
    """
    Get a pose with steps array.
    If pose doesn't have steps defined, generates default steps from structure.
    """
    pose = POSE_DATABASE.get(pose_id)
    if not pose:
        return None

    # If no steps defined, generate from structure
    if 'steps' not in pose or not pose['steps']:
        pose = {**pose, 'steps': generate_steps_from_structure(pose)}

    return pose


def generate_steps_from_structure(pose_data: Dict) -> List[Dict]:
    """
    Generate coaching steps from pose structure.
    This is a fallback for poses that don't have explicit steps.
    All instructions follow: [BODY PART] — [DIRECTION] + [ACTION]
    """
    steps = []
    structure = pose_data.get('structure', {})

    # Step 1: Feet/stance
    feet = structure.get('feet', '')
    if feet:
        steps.append({
            'instruction': f"Feet — {feet}",
            'landmark_check': {
                'type': 'feet_position',
                'description': feet.lower()
            },
            'alt_explanations': [
                "Feet — look down and check your foot placement",
                "Feet — shift your weight until they're in the right position",
                "Feet — feel stable and grounded before the next step"
            ],
            'common_mistakes': []
        })

    # Step 2: Posture/shoulders
    steps.append({
        'instruction': "Shoulders — pull them down away from your ears, then back to open your chest",
        'landmark_check': {
            'type': 'shoulders_level',
            'threshold': 0.04
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

    # Step 3: Hands/arms
    hands = structure.get('hands', '')
    if hands:
        steps.append({
            'instruction': f"Hands — {hands}",
            'landmark_check': {
                'type': 'hands_position',
                'description': hands.lower()
            },
            'alt_explanations': [
                "Arms — move them into position now",
                "Wrists — check they're at the right height",
                "Hands — place them exactly where described"
            ],
            'common_mistakes': []
        })

    # Step 4: Head position
    head = structure.get('head', '')
    if head:
        steps.append({
            'instruction': f"Head — {head}",
            'landmark_check': {
                'type': 'head_position',
                'description': head.lower()
            },
            'alt_explanations': [
                "Chin — adjust it to match the target angle",
                "Face — turn it toward the camera as described",
                "Eyes — look in the direction specified"
            ],
            'common_mistakes': []
        })

    # Fallback if structure is empty
    if not steps:
        steps = [{
            'instruction': "Face — give a natural, relaxed expression toward the camera",
            'landmark_check': {'type': 'expression'},
            'auto_advance_seconds': 8,
            'alt_explanations': [
                "Mouth — relax your jaw, let your lips part slightly",
                "Eyes — soft gaze toward the camera lens"
            ],
            'common_mistakes': []
        }]

    return steps


def save_to_file(filepath: str = "poses.json") -> None:
    """Save database to JSON file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(POSE_DATABASE, f, ensure_ascii=False, indent=2)
    logger.info(f"Database saved to {filepath}")


def load_from_file(filepath: str = "poses.json") -> None:
    """Load database from JSON file"""
    global POSE_DATABASE
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            POSE_DATABASE.clear()
            POSE_DATABASE.update(data)
        logger.info(f"Database loaded from {filepath}, {len(POSE_DATABASE)} poses")
    except FileNotFoundError:
        logger.warning(f"Database file {filepath} not found, loading examples")
        # Load example poses as defaults
        POSE_DATABASE.update(EXAMPLE_POSES)
        logger.info(f"Loaded {len(EXAMPLE_POSES)} example poses")


def init_example_poses() -> None:
    """Initialize example poses if database is empty"""
    if not POSE_DATABASE:
        POSE_DATABASE.update(EXAMPLE_POSES)
        logger.info(f"Initialized {len(EXAMPLE_POSES)} example poses")


# Initialize on import
load_from_file()
init_example_poses()
