import { create } from 'zustand';
import { Landmark } from '../types';

// 单条反馈消息的结构
export interface FeedbackItem {
  id: string;
  text: string;
  timestamp: number;
}

interface LivePoseState {
  // The real-time skeletal data of the user (updated every frame)
  currentLivePose: Landmark[] | null;
  setCurrentLivePose: (landmarks: Landmark[] | null) => void;

  // AI Feedback Queue (最新的在前面)
  feedbackQueue: FeedbackItem[];

  // 添加新反馈到队列
  addFeedback: (text: string) => void;

  // 清理过期的反馈（3秒后自动删除）
  cleanupExpiredFeedback: () => void;

  // 清空所有反馈
  clearAllFeedback: () => void;

  // 兼容旧 API（返回最新的一条）
  lastAiFeedback: string | null;
  setLastAiFeedback: (text: string | null) => void;
}

const MAX_QUEUE_SIZE = 3;
const FEEDBACK_TTL = 4000; // 4秒后淡出

export const useLivePoseStore = create<LivePoseState>((set, get) => ({
  currentLivePose: null,
  setCurrentLivePose: (landmarks) => set({ currentLivePose: landmarks }),

  feedbackQueue: [],

  addFeedback: (text: string) => {
    const newItem: FeedbackItem = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text,
      timestamp: Date.now(),
    };

    set((state) => {
      // 添加到头部，限制最大数量
      const newQueue = [newItem, ...state.feedbackQueue].slice(0, MAX_QUEUE_SIZE);
      return {
        feedbackQueue: newQueue,
        lastAiFeedback: text, // 兼容旧 API
      };
    });

    // 4秒后自动清理这条
    setTimeout(() => {
      get().cleanupExpiredFeedback();
    }, FEEDBACK_TTL);
  },

  cleanupExpiredFeedback: () => {
    const now = Date.now();
    set((state) => ({
      feedbackQueue: state.feedbackQueue.filter(
        (item) => now - item.timestamp < FEEDBACK_TTL
      ),
    }));
  },

  clearAllFeedback: () => {
    set({ feedbackQueue: [], lastAiFeedback: null });
  },

  // 兼容旧 API
  lastAiFeedback: null,
  setLastAiFeedback: (text) => {
    if (text) {
      get().addFeedback(text);
    }
  },
}));
