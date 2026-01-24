import { create } from 'zustand';

export type ViewType = 'home' | 'playlist' | 'camera' | 'result';

interface UIState {
  toast: { show: boolean; message: string };
  currentView: ViewType;
  gallery: string[]; // Array of base64 strings
  
  // Actions
  showToast: (message: string) => void;
  hideToast: () => void;
  setView: (view: ViewType) => void;
  addPhoto: (photo: string) => void;
  clearGallery: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: { show: false, message: '' },
  currentView: 'home',
  gallery: [],

  showToast: (message: string) => {
    set({ toast: { show: true, message } });
    // Auto-hide after 2 seconds
    setTimeout(() => {
      set({ toast: { show: false, message: '' } });
    }, 2000);
  },

  hideToast: () => set({ toast: { show: false, message: '' } }),
  
  setView: (view) => set({ currentView: view }),

  addPhoto: (photo) => set((state) => ({ gallery: [...state.gallery, photo] })),
  
  clearGallery: () => set({ gallery: [] }),
}));