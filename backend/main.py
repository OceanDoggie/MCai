from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging

load_dotenv()

import uvicorn
import asyncio
import json
import base64
from gemini_client import GeminiLiveClient

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backend_debug.log", mode='w')
    ]
)
logger = logging.getLogger("mcai-backend")

app = FastAPI()

# MediaPipe 关键点索引映射
POSE_LANDMARKS = {
    0: "nose", 1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear", 9: "mouth_left", 10: "mouth_right",
    11: "left_shoulder", 12: "right_shoulder", 13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist", 17: "left_pinky", 18: "right_pinky",
    19: "left_index", 20: "right_index", 21: "left_thumb", 22: "right_thumb",
    23: "left_hip", 24: "right_hip", 25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle", 29: "left_heel", 30: "right_heel",
    31: "left_foot_index", 32: "right_foot_index"
}

import math

def calculate_angle(p1, p2, p3):
    """计算三个点形成的角度（以 p2 为顶点）"""
    try:
        v1 = (p1['x'] - p2['x'], p1['y'] - p2['y'])
        v2 = (p3['x'] - p2['x'], p3['y'] - p2['y'])

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

        if mag1 * mag2 == 0:
            return 0

        cos_angle = max(-1, min(1, dot / (mag1 * mag2)))
        angle = math.acos(cos_angle)
        return int(math.degrees(angle))
    except:
        return 0

def format_pose_for_gemini(landmarks: list) -> str:
    """将 33 个关键点转换为人类可读的姿势描述"""

    # 构建字典方便访问
    lm = {item['idx']: item for item in landmarks}

    # 提取关键关节位置
    parts = []

    # 1. 头部位置
    if 0 in lm:
        nose = lm[0]
        head_pos = "center" if 0.4 < nose['x'] < 0.6 else ("left" if nose['x'] < 0.4 else "right")
        head_tilt = "level" if 0.3 < nose['y'] < 0.5 else ("high" if nose['y'] < 0.3 else "low")
        parts.append(f"Head: {head_pos}, {head_tilt}")

    # 2. 肩膀
    if 11 in lm and 12 in lm:
        l_sh, r_sh = lm[11], lm[12]
        shoulder_diff = abs(l_sh['y'] - r_sh['y'])
        shoulder_level = "level" if shoulder_diff < 0.03 else ("left higher" if l_sh['y'] < r_sh['y'] else "right higher")
        shoulder_width = round(abs(r_sh['x'] - l_sh['x']), 2)
        parts.append(f"Shoulders: {shoulder_level}, width={shoulder_width}")

    # 3. 手肘角度
    if all(i in lm for i in [11, 13, 15]):  # 左臂
        left_elbow_angle = calculate_angle(lm[11], lm[13], lm[15])
        parts.append(f"Left elbow: {left_elbow_angle}°")

    if all(i in lm for i in [12, 14, 16]):  # 右臂
        right_elbow_angle = calculate_angle(lm[12], lm[14], lm[16])
        parts.append(f"Right elbow: {right_elbow_angle}°")

    # 4. 手腕位置
    if 15 in lm and 16 in lm:
        l_wrist, r_wrist = lm[15], lm[16]
        left_hand_pos = "raised" if l_wrist['y'] < 0.4 else ("waist" if l_wrist['y'] < 0.6 else "down")
        right_hand_pos = "raised" if r_wrist['y'] < 0.4 else ("waist" if r_wrist['y'] < 0.6 else "down")
        parts.append(f"Left hand: {left_hand_pos}, Right hand: {right_hand_pos}")

    # 5. 膝盖角度
    if all(i in lm for i in [23, 25, 27]):  # 左腿
        left_knee_angle = calculate_angle(lm[23], lm[25], lm[27])
        parts.append(f"Left knee: {left_knee_angle}°")

    if all(i in lm for i in [24, 26, 28]):  # 右腿
        right_knee_angle = calculate_angle(lm[24], lm[26], lm[28])
        parts.append(f"Right knee: {right_knee_angle}°")

    # 6. 脚的位置
    if 27 in lm and 28 in lm:
        l_ankle, r_ankle = lm[27], lm[28]
        feet_width = round(abs(r_ankle['x'] - l_ankle['x']), 2)
        feet_visible = lm[27].get('v', 0) > 0.5 and lm[28].get('v', 0) > 0.5
        parts.append(f"Feet: width={feet_width}, visible={feet_visible}")

    # 7. 整体姿态判断
    if 23 in lm and 24 in lm and 11 in lm and 12 in lm:
        # 躯干倾斜
        hip_center_x = (lm[23]['x'] + lm[24]['x']) / 2
        shoulder_center_x = (lm[11]['x'] + lm[12]['x']) / 2
        lean = "neutral"
        if shoulder_center_x - hip_center_x > 0.05:
            lean = "leaning right"
        elif hip_center_x - shoulder_center_x > 0.05:
            lean = "leaning left"
        parts.append(f"Torso: {lean}")

    return "[POSE DATA] " + " | ".join(parts)


def format_target_pose_context(pose_data: dict) -> str:
    """
    将目标姿势转换为 Gemini 上下文消息。
    这会告诉 Gemini 用户想要达成的姿势。
    """
    name = pose_data.get('name', 'Unknown Pose')
    description = pose_data.get('description', '')
    head = pose_data.get('head', 'Natural position')
    hands = pose_data.get('hands', 'Relaxed by sides')
    feet = pose_data.get('feet', 'Shoulder-width apart')
    tips = pose_data.get('tips', [])

    context = f"""[TARGET POSE UPDATE]
用户选择了姿势："{name}"

摄影师机位：{description}

标准姿势要求：
- 头部：{head}
- 手臂/双手：{hands}
- 腿部/双脚：{feet}

小贴士：
{chr(10).join(f'- {tip}' for tip in tips[:3]) if tips else '- 保持放松自然'}

请基于这个目标姿势来指导用户。当用户的实时姿势数据发来时，对比目标姿势给出简短纠正建议。
一次只说一个问题，用口语化表达，如果已经很接近就给予鼓励！"""

    return context

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "MCai Backend is Running"}

@app.websocket("/ws/live")
async def live_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("=== CLIENT CONNECTED ===", flush=True)
    logger.info("Client connected to /ws/live")
    
    print("=== CREATING GEMINI CLIENT ===", flush=True)
    gemini_client = GeminiLiveClient()
    
    # "Vibe Check" Instruction - 动态姿势指导
    vibe_check_instruction = """
    你是 MCai，一个专业且亲切的 AI 摆姿教练。你的目标是帮助用户拍出完美照片。

    ## 你会收到的信息：
    1. [TARGET POSE UPDATE] - 用户选择的目标姿势，包含头部、手臂、腿部的标准要求
    2. [POSE DATA] - 用户的实时骨骼数据（头部位置、肩膀角度、手肘角度、膝盖角度等）
    3. 用户的视频画面（每秒1帧）

    ## 你的任务：
    对比用户的实时姿势和目标姿势，给出简短的纠正建议。

    ## 核心原则：
    1. **一次只说一个问题** - 不要同时给多个建议，用户会混乱
    2. **口语化表达** - 像朋友聊天一样，不要专业术语
       ✅ "左手再抬高一点点"
       ✅ "下巴微微收一下"
       ❌ "请将左肘屈曲角度调整至90度"
    3. **Vibe Check** - 如果姿势已经很接近（>80%），就夸奖而不是强行挑刺
       ✅ "很棒！就是这个感觉！"
       ✅ "完美！保持住！"
    4. **简短有力** - 每次回复不超过10个字

    ## 输出示例：
    - "左手肘往外展开一点"
    - "重心往左脚移一下"
    - "下巴抬高一点"
    - "太棒了！保持！"
    - "放松肩膀"

    如果用户说"停"或"等一下"，立即停止指导。
    """

    try:
        print("=== CONNECTING TO GEMINI ===", flush=True)
        async with gemini_client.connect(system_instruction=vibe_check_instruction) as session:
            print("=== GEMINI SESSION ESTABLISHED ===", flush=True)
            
            async def send_to_gemini():
                """Receive from React, send to Gemini"""
                try:
                    while True:
                        data = await websocket.receive_text()
                        msg = json.loads(data)
                        
                        if msg.get("type") == "audio":
                            # msg['data'] is base64 PCM
                            pcm_bytes = base64.b64decode(msg['data'])
                            
                            # Validation: Skip empty or tiny audio chunks
                            if len(pcm_bytes) < 100:
                                # logger.debug("Skipping tiny audio chunk")
                                continue
                                
                            logger.debug(f"Sending {len(pcm_bytes)} bytes of audio to Gemini")
                            # Use send_realtime_input for audio (official API method)
                            await session.send_realtime_input(audio={"data": pcm_bytes, "mime_type": "audio/pcm;rate=16000"})
                        
                        elif msg.get("type") == "image":
                             # msg['data'] is base64 JPEG
                            jpeg_bytes = base64.b64decode(msg['data'])
                            await session.send(input={"data": jpeg_bytes, "mime_type": "image/jpeg"}, end_of_turn=False)
                            
                        elif msg.get("type") == "text":
                            await session.send(input=msg['data'], end_of_turn=True)

                        elif msg.get("type") == "pose":
                            # 接收 MediaPipe 33 个关键点数据
                            landmarks = msg.get('data', [])
                            if landmarks and len(landmarks) >= 33:
                                pose_description = format_pose_for_gemini(landmarks)
                                logger.debug(f"Sending pose data to Gemini: {pose_description[:100]}...")
                                await session.send(input=pose_description, end_of_turn=False)

                        elif msg.get("type") == "set_target_pose":
                            # 接收目标姿势信息
                            pose_data = msg.get('data', {})
                            target_pose_context = format_target_pose_context(pose_data)
                            logger.info(f"Setting target pose: {pose_data.get('name', 'Unknown')}")
                            # 发送目标姿势上下文给 Gemini
                            await session.send(input=target_pose_context, end_of_turn=False)

                except WebSocketDisconnect:
                    logger.info("Client disconnected from React")
                except Exception as e:
                    logger.error(f"Error in send_to_gemini: {e}")

            async def receive_from_gemini():
                """Receive from Gemini, send to React"""
                try:
                    logger.info("Starting receive_from_gemini loop...")
                    async for response in session.receive():
                        # Handle Audio
                        server_content = response.server_content
                        if server_content is None:
                            # Keep alive or empty turn
                            continue

                        if server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                try:
                                    if part.inline_data:
                                        try:
                                            # Audio Data (PCM)
                                            raw_data = part.inline_data.data
                                            if raw_data:
                                                # 1. Encode to base64 bytes
                                                b64_bytes = base64.b64encode(raw_data)
                                                # 2. Decode to UTF-8 String (Crucial for WebSocket Text Frames)
                                                audio_str = b64_bytes.decode('utf-8')
                                                
                                                await websocket.send_json({"type": "audio", "data": audio_str})
                                        except Exception as audio_err:
                                            logger.error(f"Failed to encode/send audio: {audio_err}")

                                    if part.text:
                                        try:
                                            # Text Data
                                            await websocket.send_json({"type": "text", "data": str(part.text)})
                                        except Exception as text_err:
                                            logger.error(f"Failed to send text: {text_err}")

                                except RuntimeError as e:
                                    # Starlette/FastAPI raises RuntimeError if connection is closed
                                    if "Unexpected ASGI message" in str(e) or "disconnect" in str(e).lower():
                                        logger.info("Client disconnected while sending Gemini response.")
                                        break
                                    raise e
                                    
                        # Handle Turn Complete (End of Turn)
                        if server_content.turn_complete:
                             # logger.info("Turn complete")
                             pass
                    
                    logger.warning("Gemini receive loop finished naturally (AsyncIterator stopped).")

                except Exception as e:
                    logger.error(f"Error in receive_from_gemini: {e}")
                    # Don't silence it, let main loop know
                    raise e

            # Run both tasks concurrently
            logger.info("Starting concurrent send/receive tasks...")
            done, pending = await asyncio.wait(
                [asyncio.create_task(send_to_gemini()), asyncio.create_task(receive_from_gemini())],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            logger.info(f"One of the tasks finished. Done: {len(done)}, Pending: {len(pending)}")
            for task in done:
                try:
                     task.result()
                     logger.info("Task finished successfully.")
                except Exception as task_err:
                     logger.error(f"Task failed with error: {task_err}")
            
            for task in pending:
                logger.info("Cancelling pending task...")
                task.cancel()

    except Exception as e:
        print(f"=== ERROR: {e} ===", flush=True)
        logger.error(f"Error in live_endpoint: {e}")
        import traceback
        traceback.print_exc()
        try:
            # Send error to frontend so we can see it in console
            # Truncate to 100 chars to fit WS reason limits
            reason_msg = str(e)[:100]
            await websocket.close(code=1011, reason=reason_msg)
        except RuntimeError:
            pass # Socket might already be closed
    finally:
        logger.info("Closing WebSocket from backend.")
        # Only close if not already closed
        try:
            if websocket.client_state != WebSocketDisconnect:
                 await websocket.close()
        except RuntimeError:
            pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

