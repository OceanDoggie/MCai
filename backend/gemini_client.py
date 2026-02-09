from google import genai
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mcai-gemini")


class GeminiLiveClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
             logger.error("GEMINI_API_KEY not found in environment variables")
             raise ValueError("GEMINI_API_KEY not found")
        
        if self.api_key.startswith("TODO") or len(self.api_key) < 10:
             logger.warning("GEMINI_API_KEY looks invalid (starts with TODO or too short). Check .env file.")
        
        self.client = genai.Client(api_key=self.api_key, http_options={"api_version": "v1beta"})
        # 使用官方Live API专用模型
        self.model = "gemini-2.5-flash-native-audio-preview-12-2025"

    def connect(self, system_instruction: str = None):
        """
        Returns the async context manager for the connection.
        """
        config = {
            "response_modalities": ["AUDIO"],
            "output_audio_transcription": {},
            "thinking_config": {"thinking_budget": 0}  # Disable thinking tokens
        }

        if system_instruction:
            config["system_instruction"] = system_instruction

        return self.client.aio.live.connect(model=self.model, config=config)
