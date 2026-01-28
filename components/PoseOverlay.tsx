import React, { useEffect, useRef, useState } from 'react';
import { Pose } from '../types';
import { useLivePoseStore, FeedbackItem } from '../store/useLivePoseStore';
import { motion, AnimatePresence } from 'framer-motion';

interface PoseOverlayProps {
  pose: Pose | undefined;
}

// MediaPipe Connection Map (simplified for visual feedback)
const CONNECTIONS = [
  [11, 12], // Shoulders
  [11, 13], [13, 15], // Left Arm
  [12, 14], [14, 16], // Right Arm
  [11, 23], [12, 24], // Torso
  [23, 24], // Hips
  [23, 25], [25, 27], [27, 29], [29, 31], // Left Leg
  [24, 26], [26, 28], [28, 30], [30, 32], // Right Leg
  [0, 1], [1, 2], [2, 3], [3, 7], // Left Eye/Ear
  [0, 4], [4, 5], [5, 6], [6, 8], // Right Eye/Ear
  [9, 10] // Mouth
];

// 从 store 获取真实的音频音量
const useAudioAnalysis = () => {
  const audioLevel = useLivePoseStore((state) => state.audioLevel);
  const isSpeaking = useLivePoseStore((state) => state.isSpeaking);
  return { audioLevel, isSpeaking };
};

// 单条弹幕组件（带打字机效果 + 音频同步动画）
const FeedbackBubble: React.FC<{ item: FeedbackItem; index: number }> = ({ item, index }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const { audioLevel, isSpeaking } = useAudioAnalysis();

  // 打字机效果
  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);

    let charIndex = 0;
    const text = item.text;

    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 30); // 30ms 每个字符

    return () => {
      clearInterval(typeInterval);
    };
  }, [item.text, item.id]);

  // 根据音频音量计算动画强度
  const waveHeight = 12 + audioLevel * 12; // 12-24px（音量越大跳越高）
  const textScale = 1 + audioLevel * 0.08; // 1.0-1.08x（音量越大文字越大）
  const glowIntensity = audioLevel * 0.5; // 发光强度

  return (
    <motion.div
      initial={{ x: 300, opacity: 0, scale: 0.9 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: -100, opacity: 0, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: index * 0.05,
      }}
      className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/70 backdrop-blur-xl border-l-4 border-mcai-accent shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
    >
      {/* Voice Wave Animation Icon - 根据音量跳动 */}
      <div className="flex items-end gap-[2px] h-5 flex-shrink-0">
        {[0, 100, 200].map((delay, i) => (
          <motion.div
            key={i}
            className="w-[3px] bg-mcai-accent rounded-full"
            animate={{
              height: isTyping || isSpeaking ? `${waveHeight + (i === 1 ? 4 : 0)}px` : '6px',
              opacity: isTyping || isSpeaking ? 1 : 0.5,
            }}
            transition={{
              height: {
                duration: 0.15,
                delay: delay / 1000,
                repeat: isSpeaking ? Infinity : 0,
                repeatType: 'reverse',
              },
              opacity: { duration: 0.2 },
            }}
          />
        ))}
      </div>

      {/* 文字 - 根据音量呼吸 + 发光效果 */}
      <motion.p
        className="text-white font-medium text-sm leading-tight"
        animate={{
          scale: isTyping || isSpeaking ? textScale : 1,
          textShadow: isSpeaking
            ? `0 0 ${10 + glowIntensity * 20}px rgba(242, 169, 59, ${0.3 + glowIntensity})`
            : '0 0 4px rgba(0,0,0,0.5)',
        }}
        transition={{
          duration: 0.1,
        }}
      >
        {displayedText}
        {isTyping && <span className="animate-pulse text-mcai-accent">|</span>}
      </motion.p>
    </motion.div>
  );
};

export const PoseOverlay: React.FC<PoseOverlayProps> = ({ pose }) => {
  const feedbackQueue = useLivePoseStore((state) => state.feedbackQueue);
  const currentLivePose = useLivePoseStore((state) => state.currentLivePose);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw Skeleton on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLivePose) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter landmarks by visibility
    const validLandmarks = currentLivePose;

    // Draw Connections (Lines)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'; // Cyan for skeleton
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = validLandmarks[startIdx];
      const end = validLandmarks[endIdx];

      if (start && end && (start.visibility ?? 1) > 0.5 && (end.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw Keypoints (Dots)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    validLandmarks.forEach((lm) => {
      if ((lm.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [currentLivePose]);

  if (!pose) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <div className="relative w-full h-full flex flex-col items-center justify-center">

        {/*
            AI Guidance Bubble Queue
            弹幕从右上角飞入，垂直堆叠，最新的在最上面
        */}
        <div className="absolute top-[12%] right-4 flex flex-col items-end gap-2 z-20 max-w-[80%]">
          <AnimatePresence mode="popLayout">
            {feedbackQueue.map((item, index) => (
              <FeedbackBubble key={item.id} item={item} index={index} />
            ))}
          </AnimatePresence>
        </div>

        {/*
            Real-time Skeleton Overlay (Canvas)
            Replaces the static ghost image
        */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          width={1280}
          height={720}
        />

      </div>
    </div>
  );
};
