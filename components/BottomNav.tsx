import React from 'react';
import { Library, Camera, ListMusic } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { usePlaylistStore } from '../store/usePlaylistStore';

export const BottomNav: React.FC = () => {
  const { currentView, setView } = useUIStore();
  const { unsortedPoses } = usePlaylistStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[88px] bg-black/80 backdrop-blur-xl border-t border-white/10 pb-6 pt-2 z-50 px-6">
      <div className="flex items-center justify-between max-w-sm mx-auto h-full">
        
        {/* Library (Home) */}
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 w-16 transition-colors ${currentView === 'home' ? 'text-mcai-accent' : 'text-mcai-subtext'}`}
        >
          <Library size={24} strokeWidth={currentView === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Library</span>
        </button>

        {/* Camera (Center - Action) */}
        <button 
          onClick={() => setView('camera')}
          className="relative -top-3 group"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${currentView === 'camera' ? 'bg-mcai-accent scale-110' : 'bg-white active:scale-95'}`}>
             <Camera size={28} className="text-black" strokeWidth={2.5} />
          </div>
        </button>

        {/* Playlist (Right) */}
        <button 
          onClick={() => setView('playlist')}
          className={`flex flex-col items-center gap-1 w-16 transition-colors relative ${currentView === 'playlist' ? 'text-mcai-accent' : 'text-mcai-subtext'}`}
        >
          <div className="relative">
            <ListMusic size={24} strokeWidth={currentView === 'playlist' ? 2.5 : 2} />
            {unsortedPoses.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-mcai-accent text-black text-[9px] font-bold flex items-center justify-center rounded-full ring-2 ring-black animate-pulse">
                {unsortedPoses.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Playlist</span>
        </button>

      </div>
    </div>
  );
};