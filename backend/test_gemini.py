"""
Gemini Live API Connection Test v3
Tests different model and config combinations
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Fix Windows encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

load_dotenv()

async def test_model(client, model_name, config, test_audio=False):
    print(f"\n--- Test: {model_name} ---")
    print(f"    Config: {config}")

    try:
        async with client.aio.live.connect(model=model_name, config=config) as session:
            print("    [PASS] Connected!")

            if test_audio:
                silent_audio = bytes(3200)  # 100ms of silence
                await session.send_realtime_input(audio={"data": silent_audio, "mime_type": "audio/pcm"})
                print("    [PASS] send_realtime_input OK!")

            await session.send(input="Say OK", end_of_turn=True)
            async for response in session.receive():
                if response.server_content and response.server_content.turn_complete:
                    break
            print("    [PASS] Text interaction OK!")
            return True

    except Exception as e:
        print(f"    [FAIL] {e}")
        return False


async def main():
    print("=" * 60)
    print("Gemini Live API Model Compatibility Test")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[FAIL] GEMINI_API_KEY not set")
        return

    print(f"API Key: {api_key[:8]}...")

    from google import genai
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    tests = [
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
    print("Results Summary")
    print("=" * 60)
    for model, config, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} | {model} | {config.get('response_modalities')}")


if __name__ == "__main__":
    asyncio.run(main())
