import { create } from 'zustand';
import { Landmark } from '../types';

interface LivePoseState {
  // The real-time skeletal data of the user (updated every frame)
  currentLivePose: Landmark[] | null;

  // Action to update the pose
  setCurrentLivePose: (landmarks: Landmark[] | null) => void;

  // AI Feedback Text (Live)
  lastAiFeedback: string | null;
  setLastAiFeedback: (text: string | null) => void;
}

export const useLivePoseStore = create<LivePoseState>((set) => ({
  currentLivePose: null,
  setCurrentLivePose: (landmarks) => set({ currentLivePose: landmarks }),
  lastAiFeedback: null,
  setLastAiFeedback: (text) => set({ lastAiFeedback: text }),
}));