"""
Scene Analyzer Module
分析拍摄环境，识别可用道具和场景元素
用于让 AI 教练给出与环境相关的指令
"""

from google import genai
from google.genai import types
import os
import json
import logging
import base64
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("mcai-scene")

SCENE_ANALYZE_PROMPT = """分析这个拍摄环境，用JSON格式返回：
{
  "scene_type": "室内/户外/海边/咖啡厅/街头/公园/办公室/健身房/其他",
  "elements": [
    {"type": "道具名称", "position": "左/右/前/后/中", "usable": "怎么用（简短动作建议）"}
  ],
  "lighting": "正面光/侧光/逆光/顶光/柔和光/混合光",
  "background": "干净/略杂乱/杂乱",
  "mood": "休闲/正式/运动/浪漫/活力/文艺"
}

重点关注可以用于摆姿势的元素，例如：
- 栏杆（可以扶、靠）
- 台阶（可以坐、踩、站）
- 椅子/凳子（可以坐、靠）
- 墙壁（可以靠、手撑）
- 柱子（可以靠、手扶）
- 桌子（可以撑、靠）
- 窗户/窗台（可以靠、看向）
- 树木/植物（可以靠近、互动）
- 沙滩/草地（可以坐、躺）

只返回JSON，不要多余的话。elements数组最多返回5个最明显可用的元素。"""


class SceneAnalyzer:
    """
    场景分析器
    使用 Gemini Vision 分析拍摄环境
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found")

        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.0-flash"

    async def analyze_scene(self, base64_image: str) -> Dict[str, Any]:
        """
        分析场景图片，返回环境信息

        Args:
            base64_image: Base64编码的图片数据（不含data:image前缀）

        Returns:
            包含 scene_type, elements, lighting, background, mood 的字典
        """
        logger.info(f"Analyzing scene (image length: {len(base64_image)})")

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[
                    types.Content(parts=[
                        types.Part.from_bytes(
                            data=base64.b64decode(base64_image),
                            mime_type="image/jpeg",
                        ),
                        types.Part.from_text(text=SCENE_ANALYZE_PROMPT),
                    ])
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

            result_text = response.text
            # Clean up potential markdown formatting
            result_text = result_text.replace("```json", "").replace("```", "").strip()

            result = json.loads(result_text)
            logger.info(f"Scene analysis complete: {result.get('scene_type')}, {len(result.get('elements', []))} elements found")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse scene analysis JSON: {e}")
            # Return a default result if parsing fails
            return {
                "scene_type": "未知",
                "elements": [],
                "lighting": "未知",
                "background": "未知",
                "mood": "未知"
            }
        except Exception as e:
            logger.error(f"Scene analysis error: {e}")
            raise


def format_scene_context(scene_data: Dict[str, Any]) -> str:
    """
    将场景分析结果格式化为 prompt 可用的上下文字符串

    Args:
        scene_data: analyze_scene() 返回的字典

    Returns:
        格式化的场景描述字符串
    """
    if not scene_data:
        return ""

    scene_type = scene_data.get('scene_type', '未知')
    lighting = scene_data.get('lighting', '未知')
    background = scene_data.get('background', '未知')
    mood = scene_data.get('mood', '未知')
    elements = scene_data.get('elements', [])

    # Build elements description
    elements_desc = ""
    if elements:
        element_strs = []
        for elem in elements:
            elem_type = elem.get('type', '')
            position = elem.get('position', '')
            usable = elem.get('usable', '')
            if elem_type:
                element_strs.append(f"- {elem_type} ({position}): {usable}")
        if element_strs:
            elements_desc = "\n".join(element_strs)

    context = f"""当前拍摄环境：
场景类型: {scene_type}
光线条件: {lighting}
背景状况: {background}
整体氛围: {mood}
"""

    if elements_desc:
        context += f"""
可用道具和元素:
{elements_desc}

请根据环境里的道具和元素来调整你的指令。
比如：如果附近有栏杆，建议model手扶；有台阶可以建议坐/踩；有椅子建议靠/坐。
利用环境元素让姿势更自然、更有互动感。"""

    return context


def format_scene_summary(scene_data: Dict[str, Any]) -> str:
    """
    生成简短的场景摘要，用于前端显示

    Args:
        scene_data: analyze_scene() 返回的字典

    Returns:
        简短的场景摘要字符串
    """
    if not scene_data:
        return "未知场景"

    scene_type = scene_data.get('scene_type', '未知')
    elements = scene_data.get('elements', [])

    # Extract element types
    element_types = [elem.get('type', '') for elem in elements if elem.get('type')]

    if element_types:
        # Show at most 3 elements
        shown_elements = element_types[:3]
        return f"{scene_type}场景，发现{', '.join(shown_elements)}"
    else:
        return f"{scene_type}场景"
