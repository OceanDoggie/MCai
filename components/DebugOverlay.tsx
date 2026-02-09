import React from 'react';
import { useLivePoseStore } from '../store/useLivePoseStore';
import { Bug, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface DebugOverlayProps {
  className?: string;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ className = '' }) => {
  const debugInfo = useLivePoseStore((state) => state.coachDebugInfo);
  const coachState = useLivePoseStore((state) => state.coachState);
  const isVisible = useLivePoseStore((state) => state.debugOverlayVisible);
  const toggleDebug = useLivePoseStore((state) => state.toggleDebugOverlay);

  if (!isVisible) {
    return (
      <button
        onClick={toggleDebug}
        className={`fixed bottom-32 right-4 z-50 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-white/60 hover:text-white hover:bg-black/80 transition-all ${className}`}
        title="Show Debug Overlay"
      >
        <Bug size={20} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-32 right-4 z-50 w-80 max-h-[60vh] overflow-y-auto bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-4 font-mono text-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">Coach Debug</span>
        </div>
        <button
          onClick={toggleDebug}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X size={16} className="text-white/60" />
        </button>
      </div>

      {/* Coach State */}
      {coachState && coachState.active && (
        <div className="mb-3 pb-2 border-b border-white/10">
          <div className="text-white/40 mb-1">SESSION</div>
          <div className="text-white">
            Step: <span className="text-cyan-400">{coachState.current_step}</span> / {coachState.total_steps}
          </div>
          <div className="text-white">
            State: <span className="text-purple-400">{coachState.state}</span>
          </div>
          <div className="text-white">
            Attempt: <span className="text-orange-400">{coachState.attempt}</span>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo ? (
        <>
          {/* Check Type */}
          <div className="mb-3">
            <div className="text-white/40 mb-1">CHECK TYPE</div>
            <div className="text-cyan-300 font-bold">{debugInfo.check_type}</div>
          </div>

          {/* Result */}
          <div className="mb-3 flex items-center gap-2">
            <div className="text-white/40">RESULT:</div>
            {debugInfo.passed ? (
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle2 size={14} />
                <span className="font-bold">PASS</span>
              </div>
            ) : debugInfo.almost ? (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertCircle size={14} />
                <span className="font-bold">ALMOST</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400">
                <XCircle size={14} />
                <span className="font-bold">FAIL</span>
              </div>
            )}
          </div>

          {/* Reason */}
          {debugInfo.reason && (
            <div className="mb-3">
              <div className="text-white/40 mb-1">REASON</div>
              <div className="text-white/80 text-[10px] leading-relaxed">{debugInfo.reason}</div>
            </div>
          )}

          {/* Landmarks Used */}
          {debugInfo.landmarks_used && debugInfo.landmarks_used.length > 0 && (
            <div className="mb-3">
              <div className="text-white/40 mb-1">LANDMARKS</div>
              <div className="flex flex-wrap gap-1">
                {debugInfo.landmarks_used.map((lm, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 text-[9px]">
                    {lm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Values */}
          {debugInfo.values && Object.keys(debugInfo.values).length > 0 && (
            <div className="mb-3">
              <div className="text-white/40 mb-1">VALUES</div>
              <div className="bg-black/40 rounded p-2 space-y-1">
                {Object.entries(debugInfo.values).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-white/50">{key}:</span>
                    <span className="text-green-300">
                      {typeof value === 'number' ? value.toFixed(3) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thresholds */}
          {debugInfo.thresholds && Object.keys(debugInfo.thresholds).length > 0 && (
            <div className="mb-3">
              <div className="text-white/40 mb-1">THRESHOLDS</div>
              <div className="bg-black/40 rounded p-2 space-y-1">
                {Object.entries(debugInfo.thresholds).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-white/50">{key}:</span>
                    <span className="text-yellow-300">{value.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-white/40 text-center py-4">
          No check data yet.<br />
          Waiting for coach tick...
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-white/10 text-[9px] text-white/30">
        <div>Green = value meets threshold</div>
        <div>Yellow = threshold requirement</div>
        <div>Toggle with the bug icon</div>
      </div>
    </div>
  );
};
