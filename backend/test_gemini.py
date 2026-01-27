"""
Gemini Live API 连接测试脚本 v3
测试不同的模型和配置组合
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_model(client, model_name, config, test_audio=False):
    """测试单个模型配置"""
    print(f"\n--- 测试: {model_name} ---")
    print(f"    配置: {config}")
    
    try:
        async with client.aio.live.connect(model=model_name, config=config) as session:
            print("    ✓ 连接成功!")
            
            if test_audio:
                # 测试音频发送
                silent_audio = bytes(3200)  # 100ms of silence
                await session.send_realtime_input(audio={"data": silent_audio, "mime_type": "audio/pcm"})
                print("    ✓ send_realtime_input 成功!")
            
            # 测试文本
            await session.send(input="Say OK", end_of_turn=True)
            async for response in session.receive():
                if response.server_content and response.server_content.turn_complete:
                    break
            print("    ✓ 文本交互成功!")
            return True
            
    except Exception as e:
        print(f"    ❌ 失败: {e}")
        return False


async def main():
    print("=" * 60)
    print("Gemini Live API 模型兼容性测试")
    print("=" * 60)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY 未设置")
        return
    
    from google import genai
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    
    # 测试配置组合
    tests = [
        # 模型, 配置, 是否测试音频
        ("models/gemini-2.0-flash-exp", {"response_modalities": ["TEXT"]}, False),
        ("models/gemini-2.0-flash-exp", {"response_modalities": ["AUDIO"]}, True),
        ("models/gemini-2.0-flash-exp", {"response_modalities": ["AUDIO", "TEXT"]}, True),
        ("gemini-2.5-flash-native-audio-preview-12-2025", {"response_modalities": ["AUDIO"]}, True),
    ]
    
    results = []
    for model, config, test_audio in tests:
        result = await test_model(client, model, config, test_audio)
        results.append((model, config, result))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    for model, config, result in results:
        status = "✓ 通过" if result else "❌ 失败"
        print(f"{status} | {model} | {config.get('response_modalities')}")


if __name__ == "__main__":
    asyncio.run(main())
