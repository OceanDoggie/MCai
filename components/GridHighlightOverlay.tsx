import React, { useEffect, useState } from 'react';
import { useLivePoseStore, GridHighlight } from '../store/useLivePoseStore';

interface HighlightState {
  [key: string]: {
    color: 'green' | 'yellow' | 'amber';
    pulse: boolean;
    visible: boolean;
    fadeTimeout?: ReturnType<typeof setTimeout>;
  };
}

export const GridHighlightOverlay: React.FC = () => {
  const gridHighlights = useLivePoseStore((state) => state.gridHighlights);
  const [highlightStates, setHighlightStates] = useState<HighlightState>({});

  useEffect(() => {
    // Process incoming highlights
    const newStates: HighlightState = { ...highlightStates };

    gridHighlights.forEach((highlight) => {
      const existing = newStates[highlight.id];

      // Clear any existing fade timeout
      if (existing?.fadeTimeout) {
        clearTimeout(existing.fadeTimeout);
      }

      // Set up new state
      newStates[highlight.id] = {
        color: highlight.color,
        pulse: highlight.pulse,
        visible: true,
      };

      // Set up fade timeout for green highlights
      if (highlight.color === 'green' && highlight.fade_ms) {
        newStates[highlight.id].fadeTimeout = setTimeout(() => {
          setHighlightStates((prev) => ({
            ...prev,
            [highlight.id]: { ...prev[highlight.id], visible: false },
          }));
        }, highlight.fade_ms);
      }
    });

    setHighlightStates(newStates);

    // Cleanup timeouts on unmount
    return () => {
      Object.values(newStates).forEach((state) => {
        if (state.fadeTimeout) clearTimeout(state.fadeTimeout);
      });
    };
  }, [gridHighlights]);

  const getColorClass = (color: string, pulse: boolean) => {
    const baseColors = {
      amber: 'bg-amber-500 shadow-amber-500/50',
      yellow: 'bg-yellow-400 shadow-yellow-400/50',
      green: 'bg-green-400 shadow-green-400/50',
    };

    const pulseClass = pulse
      ? color === 'amber'
        ? 'animate-pulse-fast'
        : 'animate-pulse-slow'
      : '';

    return `${baseColors[color as keyof typeof baseColors] || ''} ${pulseClass}`;
  };

  const renderLine = (id: string, position: string) => {
    const state = highlightStates[id];
    if (!state || !state.visible) return null;

    return (
      <div
        key={id}
        className={`absolute left-0 right-0 h-[3px] transition-opacity duration-500 shadow-lg ${getColorClass(state.color, state.pulse)}`}
        style={{
          top: position,
          opacity: state.visible ? 1 : 0,
          boxShadow: `0 0 12px 2px currentColor`,
        }}
      />
    );
  };

  const renderPoint = (id: string, x: string, y: string) => {
    const state = highlightStates[id];
    if (!state || !state.visible) return null;

    const colorStyles = {
      amber: { background: '#F59E0B', boxShadow: '0 0 16px 4px rgba(245, 158, 11, 0.6)' },
      yellow: { background: '#FBBF24', boxShadow: '0 0 16px 4px rgba(251, 191, 36, 0.6)' },
      green: { background: '#4ADE80', boxShadow: '0 0 16px 4px rgba(74, 222, 128, 0.6)' },
    };

    return (
      <div
        key={id}
        className={`absolute w-[14px] h-[14px] rounded-full transition-opacity duration-500 ${state.pulse ? (state.color === 'amber' ? 'animate-pulse-fast' : 'animate-pulse-slow') : ''}`}
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          opacity: state.visible ? 1 : 0,
          ...colorStyles[state.color],
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-15">
      {/* A-line (top 1/3 horizontal) */}
      {renderLine('A_line', '33.33%')}

      {/* C-line (near bottom for feet) */}
      {renderLine('C_line', '92%')}

      {/* Point Jia (left intersection at 33.3%, 33.3%) */}
      {renderPoint('point_jia', '33.33%', '33.33%')}

      {/* Point Yi (right intersection at 66.6%, 33.3%) */}
      {renderPoint('point_yi', '66.67%', '33.33%')}

      {/* CSS for custom animations */}
      <style>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-pulse-fast {
          animation: pulse-fast 0.8s infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 1.5s infinite;
        }
      `}</style>
    </div>
  );
};
