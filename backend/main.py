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
    logger.info("Client connected to /ws/live")
    
    gemini_client = GeminiLiveClient()
    
    # "Vibe Check" Instruction
    vibe_check_instruction = """
    You are MCai, a professional AI Posing Coach. 
    Your goal is to guide the user to take the best photo based on their selected pose.
    
    Core Principles:
    1. Vibe Check: Be encouraging. Even if the pose isn't perfect, if the 'vibe' is right, praise them!
    2. Brevity: Speak in short, punchy sentences. Less is more.
    3. Visuals: Focus on Head, Hands, and Feet details.
    
    If the user says "Stop" or "Wait", acknowledge it immediately.
    """

    try:
        async with gemini_client.connect(system_instruction=vibe_check_instruction) as session:
            
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
                            await session.send(input={"data": pcm_bytes, "mime_type": "audio/pcm"}, end_of_turn=False)
                        
                        elif msg.get("type") == "image":
                             # msg['data'] is base64 JPEG
                            jpeg_bytes = base64.b64decode(msg['data'])
                            await session.send(input={"data": jpeg_bytes, "mime_type": "image/jpeg"}, end_of_turn=False)
                            
                        elif msg.get("type") == "text":
                            await session.send(input=msg['data'], end_of_turn=True)

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

