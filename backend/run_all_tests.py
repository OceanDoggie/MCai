"""
AI功能迁移 - 自动化测试套件
运行方式: cd backend && python run_all_tests.py
"""
import subprocess
import sys
import os
import json
import time

PASS = "[PASS]"
FAIL = "[FAIL]"


def run_test(name, cmd):
    print(f"\n--- {name} ---")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(__file__) or ".")
    if result.returncode == 0:
        print(f"{PASS} {name}")
        if result.stdout.strip():
            print(f"  Output: {result.stdout.strip()[:200]}")
        return True
    else:
        print(f"{FAIL} {name}")
        print(f"  Error: {(result.stderr or result.stdout).strip()[:300]}")
        return False


def main():
    print("=" * 50)
    print("  AI Migration - Automated Test Suite")
    print("=" * 50)

    results = []

    # Test 1: Init poses
    results.append(run_test(
        "Initialize pose database",
        [sys.executable, "init_poses.py"]
    ))

    # Test 2: Check poses.json
    print("\n--- Check poses.json ---")
    poses_path = os.path.join(os.path.dirname(__file__) or ".", "poses.json")
    if os.path.exists(poses_path):
        with open(poses_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        count = len(data)
        print(f"{PASS} poses.json exists with {count} poses")
        results.append(True)
    else:
        print(f"{FAIL} poses.json not found")
        results.append(False)

    # Test 3: Query pose
    print("\n--- Query pose from database ---")
    try:
        sys.path.insert(0, os.path.dirname(__file__) or ".")
        from pose_database import get_pose, POSE_DATABASE
        # Reload since it was imported at module level
        from pose_database import load_from_file
        load_from_file()
        pose = get_pose("confident-stance")
        if pose and "structure" in pose:
            print(f"{PASS} Found pose: {pose['id']}")
            print(f"  structure.head: {pose['structure']['head'][:60]}...")
            results.append(True)
        else:
            print(f"{FAIL} Pose 'confident-stance' not found or missing structure")
            results.append(False)
    except Exception as e:
        print(f"{FAIL} {e}")
        results.append(False)

    # Test 4: Vision client import
    print("\n--- Import GeminiVisionClient ---")
    try:
        from gemini_vision import GeminiVisionClient
        client = GeminiVisionClient()
        print(f"{PASS} GeminiVisionClient created, model={client.model}")
        results.append(True)
    except ValueError as e:
        if "API_KEY" in str(e):
            print(f"{PASS} Client init works (API key not set in this env, expected)")
            results.append(True)
        else:
            print(f"{FAIL} {e}")
            results.append(False)
    except Exception as e:
        print(f"{FAIL} {e}")
        results.append(False)

    # Summary
    passed = sum(results)
    total = len(results)
    print("\n" + "=" * 50)
    print(f"  Results: {passed}/{total} passed")
    if passed == total:
        print("  All tests passed!")
    else:
        print(f"  {total - passed} test(s) failed")
    print("=" * 50)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
