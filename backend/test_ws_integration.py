import asyncio
import websockets
import json


async def test_analyze_pose():
    uri = "ws://localhost:8000/ws/live"

    async with websockets.connect(uri) as websocket:
        # 1x1 white PNG for connectivity test
        test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

        # Test: list_poses
        await websocket.send(json.dumps({"type": "list_poses"}))
        response = await websocket.recv()
        print("list_poses response:", response)

        # Test: analyze_pose
        await websocket.send(json.dumps({
            "type": "analyze_pose",
            "data": f"data:image/png;base64,{test_image}",
            "source_name": "test.png"
        }))
        response = await websocket.recv()
        print("analyze_pose response:", response)


if __name__ == "__main__":
    asyncio.run(test_analyze_pose())
