import React, { useState } from 'react';
import { Star, Home, Sparkles, X, Share2, Download } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

export const ResultView: React.FC = () => {
  const { gallery, setView, clearGallery } = useUIStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDone = () => {
    // 1. Clear the current session photos (Essential for new session)
    clearGallery();
    
    // 2. Return to Home (Pose Library)
    setView('home');
    
    // Note: We do NOT clear the playlist here. 
    // This allows the user to re-shoot the same sequence if they want.
    // Users can clear the playlist manually in the Playlist view.
  };

  // Mock Data
  const score = gallery.length > 0 ? Math.floor(Math.random() * (98 - 85) + 85) : 0;
  const aiComments = [
    "Lighting is absolutely on point! 📸",
    "Great posture, very confident energy. 🔥",
    "Angles are perfect, model potential! ✨",
    "Nice variety of expressions today.",
  ];
  // Ensure we get a consistent comment for the render (in real app, this would be computed once)
  const [comment] = useState(() => aiComments[Math.floor(Math.random() * aiComments.length)]);

  // Identify "Best" shots (randomly pick 1-2 indices if gallery exists)
  const [bestShotIndices] = useState(() => 
    gallery.length > 0 ? [Math.floor(Math.random() * gallery.length)] : []
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col animate-in fade-in duration-500 relative">
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-40 no-scrollbar">
        
        {/* 1. Score Header (Centered) */}
        <div className="flex flex-col items-center pt-10 pb-6">
            <div className="relative">
                <Star size={64} className="text-mcai-accent fill-mcai-accent drop-shadow-[0_0_15px_rgba(242,169,59,0.6)] animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-black font-bold text-xs">AI</span>
                </div>
            </div>
            <h1 className="text-6xl font-black mt-2 tracking-tighter italic font-sans">{score}</h1>
            <div className="flex gap-1 mt-2">
                {[1,2,3,4,5].map(i => (
                    <Star key={i} size={14} className="text-mcai-accent fill-mcai-accent" />
                ))}
            </div>
            <p className="text-mcai-subtext text-xs uppercase tracking-widest mt-2 font-bold">Session Score</p>
        </div>

        {/* 2. AI Comment Bubble */}
        <div className="px-6 mb-8">
            <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-5 relative">
                <div className="absolute -top-3 left-6 bg-mcai-accent text-black text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Sparkles size={10} />
                    AI COACH SAYS
                </div>
                <p className="text-gray-200 text-sm leading-relaxed mt-1 italic font-medium">
                    "{comment}"
                </p>
            </div>
        </div>

        {/* 3. Photo Grid */}
        <div className="px-4">
            <div className="flex items-center justify-between mb-3 px-2">
                 <h3 className="text-sm font-bold text-white">Gallery ({gallery.length})</h3>
                 <span className="text-[10px] text-mcai-subtext">Tap to view</span>
            </div>
            
            {gallery.length === 0 ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-white/20 rounded-xl text-mcai-subtext text-xs bg-zinc-900/50">
                    No photos taken
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {gallery.map((src, idx) => {
                        const isBest = bestShotIndices.includes(idx);
                        return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedImage(src)}
                                className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 active:scale-95 transition-transform cursor-pointer group"
                            >
                                <img src={src} className="w-full h-full object-cover" alt="" />
                                {isBest && (
                                    <div className="absolute top-2 left-2 bg-mcai-accent text-black text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
                                        BEST SHOT
                                    </div>
                                )}
                                {/* Overlay hint */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </div>

      {/* 4. Fixed Bottom Action (Done Button) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent z-20">
         <button 
            onClick={handleDone}
            className="w-full py-4 bg-white text-black rounded-full font-bold text-lg tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
         >
            <Home size={20} />
            Done & Home
         </button>
         
         <div className="flex justify-center gap-8 mt-6 pb-2">
             <button className="flex items-center gap-2 text-white/50 hover:text-white text-xs font-medium transition-colors">
                <Share2 size={16} /> Share
             </button>
             <button className="flex items-center gap-2 text-white/50 hover:text-white text-xs font-medium transition-colors">
                <Download size={16} /> Save All
             </button>
         </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
            <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
            >
                <X size={24} />
            </button>
            <img 
                src={selectedImage} 
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-white/10"
                alt="Full size"
                onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
            />
        </div>
      )}

    </div>
  );
};