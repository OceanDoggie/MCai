import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

export const Toast: React.FC = () => {
  const { toast } = useUIStore();

  if (!toast.show) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
        <CheckCircle2 className="text-mcai-accent" size={20} />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
};