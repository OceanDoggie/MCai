import React from 'react';
import { Plus, Check } from 'lucide-react';
import { Pose } from '../types';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { useUIStore } from '../store/useUIStore';

interface PoseCardProps {
  pose: Pose;
}

export const PoseCard: React.FC<PoseCardProps> = ({ pose }) => {
  const addToUnsorted = usePlaylistStore((state) => state.addToUnsorted);
  const unsortedPoses = usePlaylistStore((state) => state.unsortedPoses);
  const showToast = useUIStore((state) => state.showToast);
  
  // Count how many times this specific pose is in the Unsorted Cart
  const countInCart = unsortedPoses.filter(p => p.id === pose.id).length;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    addToUnsorted(pose);
    showToast("Added to Unsorted Cart");
  };

  return (
    <div className="relative group overflow-hidden rounded-xl bg-mcai-gray aspect-[3/4] border border-white/10 hover:border-mcai-accent/50 transition-all duration-300">
      {/* Background Image */}
      <img 
        src={pose.imageSrc} 
        alt={pose.title} 
        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex justify-between items-end">
          <div className="flex-1 mr-2">
            <span className="text-[10px] uppercase tracking-wider text-mcai-accent font-bold block mb-0.5">
              {pose.category}
            </span>
            <h3 className="text-white font-medium text-sm leading-tight">
              {pose.title}
            </h3>
          </div>

          <button
            onClick={handleAdd}
            className={`
              flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border active:scale-90 transition-all
              ${countInCart > 0 
                ? 'bg-mcai-accent border-mcai-accent text-black' 
                : 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-mcai-accent hover:text-black'}
            `}
          >
            {countInCart > 0 ? (
               <span className="font-bold text-xs flex items-center"><Plus size={12}/>{countInCart}</span>
            ) : (
              <Plus size={16} />
            )}
          </button>
        </div>
      </div>
      
      {/* Difficulty Badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
        <span className="text-[9px] text-white uppercase tracking-widest">
            {pose.difficulty}
        </span>
      </div>
    </div>
  );
};