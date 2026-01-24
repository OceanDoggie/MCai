import React from 'react';
import { X, GripVertical, Trash2, Camera, PlayCircle } from 'lucide-react';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { PoseCategory } from '../types';

export const PlaylistSidebar: React.FC = () => {
  const { 
    playlist, 
    removeFromPlaylist, 
    reorderPlaylist, 
    isSidebarOpen, 
    toggleSidebar 
  } = usePlaylistStore();

  const handleMoveUp = (index: number) => {
    if (index > 0) reorderPlaylist(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < playlist.length - 1) reorderPlaylist(index, index + 1);
  };

  if (!isSidebarOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#121212] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-semibold text-white">My Playlist</h2>
          <p className="text-xs text-mcai-subtext">{playlist.length} poses selected</p>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mcai-subtext gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
              <Camera size={20} />
            </div>
            <p className="text-sm">Your playlist is empty.</p>
            <p className="text-xs opacity-60">Add poses from the library.</p>
          </div>
        ) : (
          playlist.map((item, index) => (
            <div 
              key={item.instanceId} 
              className="group flex items-center gap-3 bg-mcai-gray p-2 rounded-lg border border-white/5 hover:border-mcai-accent/30 transition-all"
            >
              <div className="flex flex-col gap-1 text-white/20">
                 <button onClick={() => handleMoveUp(index)} className="hover:text-white hover:bg-white/10 rounded p-0.5">▲</button>
                 <button onClick={() => handleMoveDown(index)} className="hover:text-white hover:bg-white/10 rounded p-0.5">▼</button>
              </div>

              <div className="h-12 w-12 rounded bg-black flex-shrink-0 overflow-hidden relative">
                 <img src={item.imageSrc} className="w-full h-full object-cover" alt="" />
                 <div className="absolute inset-0 bg-black/20" />
                 <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/60 px-1 rounded text-white">
                    {index + 1}
                 </span>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">{item.title}</h4>
                <p className="text-xs text-mcai-subtext truncate">{item.category}</p>
              </div>

              <button 
                onClick={() => removeFromPlaylist(item.instanceId)}
                className="p-2 text-white/30 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer / Start Button */}
      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md">
        <button 
          disabled={playlist.length === 0}
          className="w-full bg-mcai-accent text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
        >
          <PlayCircle size={20} strokeWidth={2.5} />
          Start Shoot
        </button>
      </div>
    </div>
  );
};