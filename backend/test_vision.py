import asyncio
from gemini_vision import GeminiVisionClient


async def test():
    client = GeminiVisionClient()

    # 最小的1x1白色PNG（base64），仅用于验证API连通性
    test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    try:
        result = await client.analyze_pose_image(test_image, "test.png")
        print("分析结果：", result)
    except Exception as e:
        print(f"错误：{e}")


if __name__ == "__main__":
    asyncio.run(test())
