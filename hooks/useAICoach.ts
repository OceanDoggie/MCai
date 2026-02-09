import React, { useState, useRef, useCallback } from 'react';
import { Pose } from '../types';

// TODO: 迁移到后端WebSocket
// import { getLiveCoachingFeedback } from '../services/gemini';

export const useAICoach = (
  pose: Pose | undefined,
  videoRef: React.RefObject<HTMLVideoElement> | null,
  isEnabled: boolean = true
) => {
  const [lastMessage, setLastMessage] = useState<{id: number, text: string} | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isProcessing = useRef(false);

  const triggerFeedback = useCallback(async () => {
    if (!pose || !isEnabled || isRateLimited || isProcessing.current) return;
    if (!videoRef?.current || videoRef.current.paused || videoRef.current.ended) return;

    try {
      isProcessing.current = true;
      setIsLoading(true);

      // TODO: 迁移到后端WebSocket
      console.warn("AI功能迁移中，使用临时数据");
      setLastMessage({
        id: Date.now(),
        text: "AI分析功能迁移到后端中..."
      });
    } finally {
      isProcessing.current = false;
      setIsLoading(false);
    }
  }, [pose, isEnabled, videoRef, isRateLimited]);

  return {
    lastMessage,
    isRateLimited,
    isLoading,
    triggerFeedback
  };
};