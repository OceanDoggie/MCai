import React, { useEffect, useRef } from 'react';
import { Pose } from '../types';
import { useLivePoseStore } from '../store/useLivePoseStore';
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

// Bottom Subtitle Bar Component (Gemini Live style)
const SubtitleBar: React.FC = () => {
  const subtitleText = useLivePoseStore((state) => state.subtitleText);
  const subtitleVisible = useLivePoseStore((state) => state.subtitleVisible);
  const isSpeaking = useLivePoseStore((state) => state.isSpeaking);
  const audioLevel = useLivePoseStore((state) => state.audioLevel);

  // Pulse effect based on audio level
  const glowIntensity = isSpeaking ? 0.3 + audioLevel * 0.4 : 0;

  return (
    <AnimatePresence>
      {subtitleVisible && subtitleText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute bottom-28 left-4 right-4 z-50 pointer-events-none"
        >
          <div
            className="mx-auto max-w-lg px-5 py-3 rounded-2xl backdrop-blur-xl border border-white/10"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              boxShadow: isSpeaking
                ? `0 0 20px rgba(242, 169, 59, ${glowIntensity}), 0 4px 20px rgba(0, 0, 0, 0.4)`
                : '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="flex items-center gap-3">
              {/* Voice indicator */}
              <div className="flex items-end gap-[2px] h-4 flex-shrink-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] bg-mcai-accent rounded-full"
                    animate={{
                      height: isSpeaking
                        ? `${8 + audioLevel * 8 + (i === 1 ? 4 : 0)}px`
                        : '4px',
                      opacity: isSpeaking ? 1 : 0.5,
                    }}
                    transition={{
                      height: { duration: 0.1 },
                      opacity: { duration: 0.2 },
                    }}
                  />
                ))}
              </div>

              {/* Subtitle text */}
              <motion.p
                className="text-white text-sm font-medium leading-relaxed"
                animate={{
                  textShadow: isSpeaking
                    ? `0 0 8px rgba(242, 169, 59, ${glowIntensity})`
                    : 'none',
                }}
              >
                {subtitleText}
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PoseOverlay: React.FC<PoseOverlayProps> = ({ pose }) => {
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

        {/* Bottom Subtitle Bar (replaces floating bubbles) */}
        <SubtitleBar />

        {/* Real-time Skeleton Overlay (Canvas) */}
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
