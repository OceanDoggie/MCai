import React, { useState, useRef, useCallback } from 'react';
import { Pose } from '../types';
import { getLiveCoachingFeedback } from '../services/gemini';

export const useAICoach = (
  pose: Pose | undefined, 
  videoRef: React.RefObject<HTMLVideoElement> | null,
  isEnabled: boolean = true
) => {
  const [lastMessage, setLastMessage] = useState<{id: number, text: string} | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isProcessing = useRef(false);

  /**
   * Manual trigger for AI feedback. 
   * This is called when the pose changes or user requests coaching.
   */
  const triggerFeedback = useCallback(async () => {
    if (!pose || !isEnabled || isRateLimited || isProcessing.current) return;
    if (!videoRef?.current || videoRef.current.paused || videoRef.current.ended) return;

    try {
      isProcessing.current = true;
      setIsLoading(true);
      
      const canvas = document.createElement('canvas');
      const scale = 0.5; 
      canvas.width = videoRef.current.videoWidth * scale;
      canvas.height = videoRef.current.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const userFrameBase64 = canvas.toDataURL('image/jpeg', 0.6); 
          
          const feedback = await getLiveCoachingFeedback(pose.imageSrc, userFrameBase64, pose.structure);
          
          setLastMessage({
              id: Date.now(),
              text: feedback
          });
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          setIsRateLimited(true);
          setLastMessage({ id: Date.now(), text: "AI Offline (Quota Exceeded)" });
      }
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