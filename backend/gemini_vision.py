from google import genai
from google.genai import types
import os
import json
import logging
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mcai-vision")

ANALYZE_PROMPT = """分析这个姿势照片，生成专业的拍摄指导。

返回格式要求（纯JSON，无Markdown）：
{
  "title": "姿势名称（中文，简洁）",
  "difficulty": "Easy/Medium/Hard",
  "description": "摄影师机位指导语（格式：[站距] arms ([距离]m) | [倍数]x | [高度] Level | [角度] [度数]°）",
  "structure": {
    "head": "头部姿势的详细描述（英文，给AI模型看的，要具体到角度、方向）",
    "hands": "手部姿势的详细描述（英文，具体到位置、动作）",
    "feet": "脚部姿势的详细描述（英文，具体到站姿、重心）"
  },
  "tips": ["拍摄建议1", "拍摄建议2", "拍摄建议3"],
  "tags": ["标签1", "标签2", "标签3"]
}

description示例：
- 站姿全身: "2 arms (1.8m) | 1x | Chest Level | Inward 15°"
- 蹲姿: "1 arm (1.2m) | 2x | Neck Level | Outward 10°"
- 脸部特写: "2 arms (1.8m) | 3x | Neck Level | Inward 15°"

structure要非常具体，例如：
- head: "Chin high and look slightly away with a confident gaze."
- hands: "Rest your hand on your waist and pull your elbow back to create space."
- feet: "Cross your front leg over and point your toe toward the camera."
"""


class GeminiVisionClient:
    """
    Gemini 视觉分析客户端
    用于分析用户上传的参考姿势图片
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found")

        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.0-flash"

    async def analyze_pose_image(self, base64_image: str, source_name: str = "unknown") -> Dict[str, Any]:
        """
        分析姿势图片，生成固定提示词

        Args:
            base64_image: Base64编码的图片数据（不含data:image前缀）
            source_name: 图片来源名称（用于日志）

        Returns:
            包含 title, difficulty, description, structure, tips, tags 的字典
        """
        logger.info(f"Analyzing pose image: {source_name} (length: {len(base64_image)})")

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[
                    types.Content(parts=[
                        types.Part.from_bytes(
                            data=__import__("base64").b64decode(base64_image),
                            mime_type="image/jpeg",
                        ),
                        types.Part.from_text(text=ANALYZE_PROMPT),
                    ])
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

            result_text = response.text
            result_text = result_text.replace("```json", "").replace("```", "").strip()

            result = json.loads(result_text)
            logger.info(f"Analysis complete: {result.get('title')}")
            return result

        except Exception as e:
            logger.error(f"Vision analysis error: {e}")
            raise
