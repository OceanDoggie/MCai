import React, { useState } from 'react';
import { Search, ListFilter } from 'lucide-react';
import { MOCK_POSES } from '../data/mockPoses';
import { PoseCategory } from '../types';
import { PoseCard } from '../components/PoseCard';

export const HomeView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const categories = ['All', ...Object.values(PoseCategory)];

  const filteredPoses = MOCK_POSES.filter(pose => {
    const matchesCategory = selectedCategory === 'All' || pose.category === selectedCategory;
    const matchesSearch = pose.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          pose.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pb-24 animate-in fade-in duration-500">
      {/* Header Section (Title + Search + Tags) */}
      <header className="pt-6 px-4 bg-gradient-to-b from-black to-black/95 sticky top-0 z-40 pb-2">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-white">Pose Library</h1>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mcai-subtext" size={18} />
            <input 
                type="text" 
                placeholder="Search poses, styles..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-mcai-gray border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-mcai-accent/50 placeholder:text-zinc-600 transition-all shadow-inner"
            />
        </div>

        {/* Category Pills */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 mask-linear-fade">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`
                        px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border
                        ${selectedCategory === cat 
                            ? 'bg-mcai-accent border-mcai-accent text-black shadow-[0_0_10px_rgba(242,169,59,0.3)]' 
                            : 'bg-white/5 border-white/10 text-mcai-subtext hover:bg-white/10 hover:text-white'}
                    `}
                >
                    {cat}
                </button>
            ))}
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="px-4 pt-2 max-w-4xl mx-auto">
        
        {/* Pose Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPoses.map(pose => (
                <PoseCard key={pose.id} pose={pose} />
            ))}
        </div>

        {/* Empty State */}
        {filteredPoses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-mcai-subtext">
                <ListFilter size={48} className="mb-4 opacity-20" />
                <p>No poses found matching your filters.</p>
                <button 
                    onClick={() => {setSelectedCategory('All'); setSearchQuery('');}}
                    className="mt-4 text-mcai-accent text-sm hover:underline"
                >
                    Clear filters
                </button>
            </div>
        )}
      </main>
    </div>
  );
};