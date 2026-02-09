from pose_database import add_pose, save_to_file


def init_default_poses():
    add_pose("confident-stance", {
        "title": "自信站姿",
        "difficulty": "Easy",
        "description": "2 arms (1.8m) | 1x | Chest Level | Inward 15°",
        "structure": {
            "head": "Chin high and look slightly away with a confident gaze.",
            "hands": "Rest your hand on your waist and pull your elbow back to create space.",
            "feet": "Cross your front leg over and point your toe toward the camera."
        },
        "tips": ["保持背部挺直", "肩膀自然下沉", "视线看向镜头偏上方"],
        "tags": ["站姿", "全身", "简单"]
    })

    add_pose("wall-lean", {
        "title": "墙靠姿势",
        "difficulty": "Easy",
        "description": "2 arms (2.0m) | 1x | Chest Level | Inward 15°",
        "structure": {
            "head": "Lean your head back against the wall and keep your expression soft.",
            "hands": "Bring both hands up to your hair and let your elbows go wide.",
            "feet": "Lean your hip into the wall and keep your legs long and straight."
        },
        "tips": ["头部贴墙，表情放松", "双手自然上扬", "一侧臀部靠墙"],
        "tags": ["站姿", "全身", "简单", "靠墙"]
    })

    save_to_file()
    from pose_database import POSE_DATABASE
    print(f"Default poses initialized: {len(POSE_DATABASE)} poses")


if __name__ == "__main__":
    init_default_poses()
