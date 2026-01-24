import { create } from 'zustand';
import { Pose, PlaylistItem, SavedPlaylist } from '../types';

interface PlaylistState {
  // The "Active" queue used by the Camera View
  playlist: PlaylistItem[];

  // The "Unsorted/Cart" area (added from Library, waiting to be organized)
  unsortedPoses: PlaylistItem[];

  // The "My Booklet" area (Multiple named playlists)
  savedPlaylists: SavedPlaylist[];

  isSidebarOpen: boolean;

  // Actions
  addToUnsorted: (pose: Pose) => void;
  moveFromUnsortedToPlaylist: (playlistId: string, poseInstanceId: string) => void;
  moveBatchToPlaylist: (playlistId: string, instanceIds: string[]) => void;
  updatePlaylistItems: (playlistId: string, items: PlaylistItem[]) => void;
  createNewPlaylist: (title?: string) => void;
  deleteSavedPlaylist: (playlistId: string) => void;
  setActiveSession: (items: PlaylistItem[]) => void;

  // Legacy/Helpers
  removeFromPlaylist: (instanceId: string) => void; // Removes from Active
  removeFromUnsorted: (instanceId: string) => void;
  removeFromSavedPlaylist: (playlistId: string, instanceId: string) => void;
  clearPlaylist: () => void;
  isInUnsorted: (poseId: string) => boolean;

  // UI Actions
  toggleSidebar: () => void;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlist: [],
  unsortedPoses: [],
  savedPlaylists: [
    { id: 'pl-1', title: 'Morning Shoot', items: [] },
    { id: 'pl-2', title: 'Studio Vibes', items: [] }
  ],
  isSidebarOpen: false,

  addToUnsorted: (pose: Pose) => {
    const state = get();
    // Fix: Prevent duplicates
    if (state.unsortedPoses.some(p => p.id === pose.id)) {
      return;
    }

    const newItem: PlaylistItem = {
      ...pose,
      instanceId: `${pose.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    set((state) => ({
      unsortedPoses: [...state.unsortedPoses, newItem],
    }));
  },

  moveFromUnsortedToPlaylist: (playlistId: string, poseInstanceId: string) => {
    set((state) => {
      // Find item in unsorted
      const itemToMove = state.unsortedPoses.find(p => p.instanceId === poseInstanceId);
      if (!itemToMove) return state;

      // Remove from unsorted
      const newUnsorted = state.unsortedPoses.filter(p => p.instanceId !== poseInstanceId);

      // Add to specific saved playlist
      const newSavedPlaylists = state.savedPlaylists.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, items: [...pl.items, itemToMove] };
        }
        return pl;
      });

      return {
        unsortedPoses: newUnsorted,
        savedPlaylists: newSavedPlaylists
      };
    });
  },

  moveBatchToPlaylist: (playlistId: string, instanceIds: string[]) => {
    set((state) => {
      // Filter items to move
      const itemsToMove = state.unsortedPoses.filter(p => instanceIds.includes(p.instanceId));
      if (itemsToMove.length === 0) return state;

      // Remove from unsorted
      const newUnsorted = state.unsortedPoses.filter(p => !instanceIds.includes(p.instanceId));

      // Add to specific saved playlist
      const newSavedPlaylists = state.savedPlaylists.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, items: [...pl.items, ...itemsToMove] };
        }
        return pl;
      });

      return {
        unsortedPoses: newUnsorted,
        savedPlaylists: newSavedPlaylists
      };
    });
  },

  updatePlaylistItems: (playlistId: string, items: PlaylistItem[]) => {
    set((state) => ({
      savedPlaylists: state.savedPlaylists.map(pl =>
        pl.id === playlistId ? { ...pl, items } : pl
      )
    }));
  },

  createNewPlaylist: (title = 'New Collection') => {
    set((state) => ({
      savedPlaylists: [
        ...state.savedPlaylists,
        {
          id: `pl-${Date.now()}`,
          title: `${title} ${state.savedPlaylists.length + 1}`,
          items: []
        }
      ]
    }));
  },

  deleteSavedPlaylist: (playlistId: string) => {
    set((state) => ({
      savedPlaylists: state.savedPlaylists.filter(pl => pl.id !== playlistId)
    }));
  },

  setActiveSession: (items: PlaylistItem[]) => {
    set({ playlist: items });
  },

  // Legacy / Direct Manipulation
  removeFromPlaylist: (instanceId: string) => {
    set((state) => ({
      playlist: state.playlist.filter((item) => item.instanceId !== instanceId),
    }));
  },

  removeFromUnsorted: (instanceId: string) => {
    set((state) => ({
      unsortedPoses: state.unsortedPoses.filter((item) => item.instanceId !== instanceId),
    }));
  },

  removeFromSavedPlaylist: (playlistId: string, instanceId: string) => {
    set((state) => ({
      savedPlaylists: state.savedPlaylists.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, items: pl.items.filter(i => i.instanceId !== instanceId) };
        }
        return pl;
      })
    }));
  },

  clearPlaylist: () => {
    set({ playlist: [] });
  },

  isInUnsorted: (poseId: string) => {
    return get().unsortedPoses.some((item) => item.id === poseId);
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  reorderPlaylist: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newPlaylist = [...state.playlist];
      if (fromIndex < 0 || fromIndex >= newPlaylist.length || toIndex < 0 || toIndex >= newPlaylist.length) {
        return state;
      }
      const [movedItem] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, movedItem);
      return { playlist: newPlaylist };
    });
  },
}));