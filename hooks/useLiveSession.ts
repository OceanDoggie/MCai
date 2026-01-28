
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLivePoseStore } from '../store/useLivePoseStore';

const WEBSOCKET_URL = "ws://localhost:8000/ws/live";

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const useLiveSession = () => {
    const [status, setStatus] = useState<LiveStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);
    const isDisconnectingRef = useRef<boolean>(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log("[LiveSession] Component unmounting, cleaning up...");
            cleanupSession();
        };
    }, []);

    const cleanupSession = useCallback(() => {
        isDisconnectingRef.current = true;

        if (wsRef.current) {
            // Prevent recursive onclose calls if possible, or just close it.
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            audioContextRef.current = null;
        }

        setStatus('disconnected');
    }, []);

    const disconnect = useCallback(() => {
        console.log("[LiveSession] Disconnecting manually...");
        // Set flag immediately to prevent onclose handler from thinking it's an error
        isDisconnectingRef.current = true;
        cleanupSession();
    }, [cleanupSession]);

    // --- Audio Capture (Mic -> Server) ---
    const startAudioCapture = async (ctx: AudioContext, stream: MediaStream, ws: WebSocket) => {
        try {
            // Load Worklet
            try {
                await ctx.audioWorklet.addModule('/audio-processor.js');
                console.log("[Audio] AudioWorklet module loaded.");
            } catch (e) {
                console.error("[Audio] Failed to load audio-processor.js. Check /public folder.", e);
                // Swallow error if already loaded, but log it. 
                // However, addModule handles deduplication usually.
            }

            const source = ctx.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(ctx, 'audio-processor');

            workletNode.port.onmessage = (event) => {
                if (ws.readyState !== WebSocket.OPEN) return;

                // Float32Array from worklet
                const float32Data = event.data;
                const pcmData = floatTo16BitPCM(float32Data);
                const base64String = arrayBufferToBase64(pcmData);

                ws.send(JSON.stringify({ type: 'audio', data: base64String }));
            };

            source.connect(workletNode);

            // Connect to mute destination to keep pipeline alive in Chrome
            const gain = ctx.createGain();
            gain.gain.value = 0;
            workletNode.connect(gain);
            gain.connect(ctx.destination);

            console.log("[Audio] AudioWorklet pipeline started.");

        } catch (err) {
            console.error("Failed to start audio pipeline:", err);
            throw err;
        }
    };

    const connect = useCallback(async () => {
        // Prevent rapid reconnects
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        // Ensure clean state logic
        if (wsRef.current) {
            wsRef.current.close(); // Force close old one
            wsRef.current = null;
        }
        isDisconnectingRef.current = false;

        setStatus('connecting');

        try {
            // 1. Initialize Audio Context
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = ctx;

            // Explicitly resume on user interaction
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // 2. Microphone Access
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
            } catch (err) {
                console.error("Microphone permission denied:", err);
                setStatus('error');
                return;
            }

            // 3. Connect WebSocket
            const ws = new WebSocket(WEBSOCKET_URL);
            wsRef.current = ws;

            ws.onopen = async () => {
                console.log("[WebSocket] Connected");
                setStatus('connected');

                try {
                    await startAudioCapture(ctx, stream, ws);
                } catch (audioErr) {
                    console.error("Audio capture critical failure:", audioErr);
                    setStatus('error');
                    ws.close();
                }
            };

            ws.onclose = (event) => {
                console.log(`[Debug] Connection closed by: ${event.wasClean ? 'Cleanly (Code)' : 'Abruptly (Network/Server)'}`);
                // Enhanced logging as requested
                console.error("[WebSocket] Disconnected. Code:", event.code, "Reason:", event.reason);

                // CRITICAL FIX: Loop Prevention & Fatal Error Handling
                if (!isDisconnectingRef.current) {
                    // 1011: Internal Error (Backend caught exception)
                    // 1008: Policy Violation
                    if (event.code === 1011 || event.code === 1008) {
                        console.error("[WebSocket] Fatal Error from Backend:", event.reason);
                        setStatus('error');
                        wsRef.current = null;
                        return;
                    }

                    // For other unexpected disconnects (including 1000 if unexpected), set error to stop loop
                    console.error("[WebSocket] Unexpected disconnect! Setting status to ERROR to stop loop.");
                    setStatus('error');
                    wsRef.current = null;
                } else {
                    // Manual disconnect, normal reset
                    if (wsRef.current) {
                        setStatus('disconnected');
                        wsRef.current = null;
                    }
                }
            };

            ws.onerror = (error) => {
                console.error("[WebSocket] Error:", error);
                // OnError usually follows with OnClose, so let OnClose handle state update if needed, but safe to set likely error here too
                // status update handled in onclose usually
            };

            ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    // Handle error messages from backend
                    if (msg.type === 'error') {
                        console.error("[Backend Error]", msg.message);
                        // We could show toast here
                        return;
                    }

                    if (msg.type === 'audio') {
                        playAudioChunk(msg.data);
                    } else if (msg.type === 'text') {
                        useLivePoseStore.getState().setLastAiFeedback(msg.data);
                    }
                } catch (e) {
                    console.error("Parse message error", e);
                }
            };

        } catch (err) {
            console.error("Connection failed catch block:", err);
            setStatus('error');
        }
    }, [cleanupSession]);

    // --- Audio Playback (Server -> Speaker) with Volume Analysis ---
    const playAudioChunk = (base64Audio: string) => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;

        const pcmData = base64ToArrayBuffer(base64Audio);
        const floatData = int16ToFloat32(pcmData);

        // 计算音频音量 (RMS)
        let sum = 0;
        for (let i = 0; i < floatData.length; i++) {
            sum += floatData[i] * floatData[i];
        }
        const rms = Math.sqrt(sum / floatData.length);
        const normalizedLevel = Math.min(1, rms * 3); // 放大并限制在0-1

        // 更新 store 中的音量状态
        useLivePoseStore.getState().setAudioLevel(normalizedLevel);
        useLivePoseStore.getState().setIsSpeaking(true);

        // Gemini Live API outputs audio at 24kHz (not 16kHz!)
        const buffer = ctx.createBuffer(1, floatData.length, 24000);
        buffer.getChannelData(0).set(floatData);

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // 创建分析器节点用于实时音量监测
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        // Simple queueing to prevent overlap/gaps
        const currentTime = ctx.currentTime;
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
        }
        source.start(nextStartTimeRef.current);

        // 音频播放结束后重置状态
        const duration = buffer.duration;
        setTimeout(() => {
            useLivePoseStore.getState().setAudioLevel(0);
            useLivePoseStore.getState().setIsSpeaking(false);
        }, (nextStartTimeRef.current - currentTime + duration) * 1000);

        nextStartTimeRef.current += duration;
    };

    // --- Video/Image Send ---
    const sendExactFrame = useCallback((base64Image: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // remove header
            const data = base64Image.split(',')[1];
            wsRef.current.send(JSON.stringify({ type: 'image', data }));
        }
    }, []);

    // --- Pose Landmarks Send ---
    const sendPoseData = useCallback((landmarks: Array<{x: number, y: number, z: number, visibility?: number}>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // 只发送关键点的简化数据
            const simplifiedLandmarks = landmarks.map((lm, idx) => ({
                idx,
                x: Math.round(lm.x * 1000) / 1000,  // 保留3位小数
                y: Math.round(lm.y * 1000) / 1000,
                z: Math.round(lm.z * 1000) / 1000,
                v: Math.round((lm.visibility ?? 1) * 100) / 100
            }));
            wsRef.current.send(JSON.stringify({ type: 'pose', data: simplifiedLandmarks }));
        }
    }, []);

    // --- Set Target Pose (告诉 Gemini 用户选了哪个姿势) ---
    const setTargetPose = useCallback((pose: {
        id: string;
        title: string;
        description: string;
        structure: { head: string; hands: string; feet: string };
        tips: string[];
    }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('[LiveSession] Setting target pose:', pose.title);
            wsRef.current.send(JSON.stringify({
                type: 'set_target_pose',
                data: {
                    id: pose.id,
                    name: pose.title,
                    description: pose.description,
                    head: pose.structure.head,
                    hands: pose.structure.hands,
                    feet: pose.structure.feet,
                    tips: pose.tips
                }
            }));
        }
    }, []);

    return { status, connect, disconnect, sendExactFrame, sendPoseData, setTargetPose };
};

// --- Helpers ---

function floatTo16BitPCM(output: Float32Array) {
    const buffer = new ArrayBuffer(output.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < output.length; i++) {
        let s = Math.max(-1, Math.min(1, output[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function int16ToFloat32(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const len = buffer.byteLength / 2;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        const int16 = view.getInt16(i * 2, true);
        float32[i] = int16 / 32768.0;
    }
    return float32;
}
