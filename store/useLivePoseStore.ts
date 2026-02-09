import { create } from 'zustand';
import { Landmark } from '../types';

// 单条反馈消息的结构
export interface FeedbackItem {
  id: string;
  text: string;
  timestamp: number;
}

// Coach state update from backend
export interface CoachStateUpdate {
  active: boolean;
  current_step: number;
  total_steps: number;
  state: 'idle' | 'instruction' | 'watching' | 'confirmed' | 'complete';
  attempt: number;
  completed_steps?: number[];
}

// Debug info for landmark checks
export interface CoachDebugInfo {
  check_type: string;
  landmarks_used: string[];
  values: Record<string, number | string>;
  thresholds: Record<string, number>;
  passed: boolean;
  almost: boolean;
  reason: string;
}

// Grid highlight for UI feedback
export interface GridHighlight {
  id: 'A_line' | 'C_line' | 'point_jia' | 'point_yi';
  color: 'green' | 'yellow' | 'amber';
  pulse: boolean;
  fade_ms?: number;
}

interface LivePoseState {
  // The real-time skeletal data of the user (updated every frame)
  currentLivePose: Landmark[] | null;
  setCurrentLivePose: (landmarks: Landmark[] | null) => void;

  // AI 语音音量 (0-1)，用于同步弹幕动画
  audioLevel: number;
  setAudioLevel: (level: number) => void;

  // AI 是否正在说话
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;

  // === NEW: Subtitle-style feedback ===
  // Current subtitle text (appended, not stacked)
  subtitleText: string;
  subtitleVisible: boolean;
  subtitleLastUpdate: number;

  // Add new text to subtitle (appends to existing line)
  appendSubtitle: (text: string) => void;

  // Clear subtitle
  clearSubtitle: () => void;

  // === Coach Mode State ===
  coachState: CoachStateUpdate | null;
  setCoachState: (state: CoachStateUpdate | null) => void;

  // === Coach Debug Info ===
  coachDebugInfo: CoachDebugInfo | null;
  setCoachDebugInfo: (info: CoachDebugInfo | null) => void;
  debugOverlayVisible: boolean;
  toggleDebugOverlay: () => void;

  // === Grid Highlights ===
  gridHighlights: GridHighlight[];
  setGridHighlights: (highlights: GridHighlight[]) => void;

  // === Legacy API (kept for compatibility) ===
  feedbackQueue: FeedbackItem[];
  addFeedback: (text: string) => void;
  cleanupExpiredFeedback: () => void;
  clearAllFeedback: () => void;
  lastAiFeedback: string | null;
  setLastAiFeedback: (text: string | null) => void;
}

const MAX_QUEUE_SIZE = 3;
const FEEDBACK_TTL = 4000; // 4秒后淡出
const SUBTITLE_FADE_DELAY = 2000; // 2秒无新内容后淡出

// Check if text looks like thinking tokens (starts with ** or contains markdown-style thinking)
const isThinkingToken = (text: string): boolean => {
  const trimmed = text.trim();
  // Common thinking patterns: **Assessing**, **Thinking**, etc.
  if (trimmed.startsWith('**') && trimmed.includes('**')) return true;
  // Also filter out purely punctuation/whitespace
  if (trimmed.length < 2) return true;
  return false;
};

let subtitleTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useLivePoseStore = create<LivePoseState>((set, get) => ({
  currentLivePose: null,
  setCurrentLivePose: (landmarks) => set({ currentLivePose: landmarks }),

  audioLevel: 0,
  setAudioLevel: (level) => set({ audioLevel: level }),

  isSpeaking: false,
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),

  // === Subtitle State ===
  subtitleText: '',
  subtitleVisible: false,
  subtitleLastUpdate: 0,

  appendSubtitle: (text: string) => {
    // Filter out thinking tokens
    if (isThinkingToken(text)) {
      console.log('[Subtitle] Ignoring thinking token:', text.substring(0, 30));
      return;
    }

    const now = Date.now();
    const state = get();

    // If more than 3 seconds since last update, start fresh
    const shouldReset = now - state.subtitleLastUpdate > 3000;

    // Append or replace
    const newText = shouldReset ? text : (state.subtitleText + text);

    set({
      subtitleText: newText,
      subtitleVisible: true,
      subtitleLastUpdate: now,
    });

    // Clear any existing timeout
    if (subtitleTimeoutId) {
      clearTimeout(subtitleTimeoutId);
    }

    // Set fade-out timeout
    subtitleTimeoutId = setTimeout(() => {
      set({ subtitleVisible: false });
      // Clear text after fade animation
      setTimeout(() => {
        set({ subtitleText: '' });
      }, 500);
    }, SUBTITLE_FADE_DELAY);
  },

  clearSubtitle: () => {
    if (subtitleTimeoutId) {
      clearTimeout(subtitleTimeoutId);
    }
    set({ subtitleText: '', subtitleVisible: false });
  },

  // === Coach Mode State ===
  coachState: null,
  setCoachState: (state) => set({ coachState: state }),

  // === Coach Debug Info ===
  coachDebugInfo: null,
  setCoachDebugInfo: (info) => set({ coachDebugInfo: info }),
  debugOverlayVisible: false,
  toggleDebugOverlay: () => set((state) => ({ debugOverlayVisible: !state.debugOverlayVisible })),

  // === Grid Highlights ===
  gridHighlights: [],
  setGridHighlights: (highlights) => set({ gridHighlights: highlights }),

  // === Legacy API ===
  feedbackQueue: [],

  addFeedback: (text: string) => {
    // Filter out thinking tokens
    if (isThinkingToken(text)) {
      console.log('[Feedback] Ignoring thinking token:', text.substring(0, 30));
      return;
    }

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

  // 兼容旧 API - now also updates subtitle
  lastAiFeedback: null,
  setLastAiFeedback: (text) => {
    if (text) {
      get().appendSubtitle(text); // Use new subtitle system
      get().addFeedback(text);    // Keep legacy for compatibility
    }
  },
}));
