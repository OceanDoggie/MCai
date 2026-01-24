import React, { useEffect, useState, useRef } from 'react';
import { Pose, Landmark } from '../types';
import { useLivePoseStore } from '../store/useLivePoseStore';

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

export const PoseOverlay: React.FC<PoseOverlayProps> = ({ pose }) => {
  const lastAiFeedback = useLivePoseStore((state) => state.lastAiFeedback);
  const currentLivePose = useLivePoseStore((state) => state.currentLivePose);

  const suggestion = lastAiFeedback;
  const isVisible = !!lastAiFeedback;

  const [renderSuggestion, setRenderSuggestion] = useState(suggestion);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync suggestion for exit animation
  useEffect(() => {
    if (isVisible) {
      setRenderSuggestion(suggestion);
    }
  }, [isVisible, suggestion]);

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
            AI Guidance Bubble 
        */}
        <div className="absolute top-[18%] left-0 right-0 flex justify-center z-20 overflow-visible h-20">
          <div
            className={`
                bg-black/60 backdrop-blur-xl px-5 py-3 rounded-full border border-mcai-accent/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-3
                transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}
            `}
          >
            {/* Voice Wave Animation Icon */}
            <div className="flex items-center gap-[2px] h-3">
              <div className="w-[3px] bg-mcai-accent rounded-full animate-[bounce_1.2s_infinite]" />
              <div className="w-[3px] bg-mcai-accent rounded-full animate-[bounce_0.9s_infinite]" style={{ animationDelay: '0.1s' }} />
              <div className="w-[3px] bg-mcai-accent rounded-full animate-[bounce_1.4s_infinite]" style={{ animationDelay: '0.2s' }} />
            </div>

            <p className="text-white font-medium text-sm leading-none pt-[1px] drop-shadow-md whitespace-nowrap">
              {renderSuggestion}
            </p>
          </div>
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