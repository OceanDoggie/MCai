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
        
        self.client = genai.Client(api_key=self.api_key, http_options={"api_version": "v1alpha"})
        # Using stable Gemini 2.0 Flash model
        self.model = "models/gemini-2.0-flash-exp"

    def connect(self, system_instruction: str = None):
        """
        Returns the async context manager for the connection.
        """
        # 最简配置 - 只请求音频响应
        config = {
            "response_modalities": ["AUDIO"]
        }
        
        # 暂时注释掉 system_instruction，先测试基础连接
        # if system_instruction:
        #     config["system_instruction"] = {"parts": [{"text": system_instruction}]}
            
        return self.client.aio.live.connect(model=self.model, config=config)
