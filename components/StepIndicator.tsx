import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLivePoseStore, CoachStateUpdate } from '../store/useLivePoseStore';
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';

interface StepIndicatorProps {
  className?: string;
}

// State color mapping
const getStateColor = (state: CoachStateUpdate['state']) => {
  switch (state) {
    case 'instruction':
      return 'text-mcai-accent';
    case 'watching':
      return 'text-blue-400';
    case 'confirmed':
      return 'text-green-400';
    case 'complete':
      return 'text-green-500';
    default:
      return 'text-white/60';
  }
};

// State label
const getStateLabel = (state: CoachStateUpdate['state']) => {
  switch (state) {
    case 'instruction':
      return 'Listen...';
    case 'watching':
      return 'Checking...';
    case 'confirmed':
      return 'Perfect!';
    case 'complete':
      return 'All Done!';
    default:
      return '';
  }
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({ className = '' }) => {
  const coachState = useLivePoseStore((state) => state.coachState);

  // Don't render if coach not active
  if (!coachState || !coachState.active) {
    return null;
  }

  const { current_step, total_steps, state, attempt, completed_steps = [] } = coachState;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3 }}
        className={`bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-mcai-accent font-black text-[9px] uppercase tracking-wider">
            Coach Mode
          </span>
          <span className={`text-[9px] font-bold ${getStateColor(state)}`}>
            {getStateLabel(state)}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: total_steps }).map((_, idx) => {
            const stepNum = idx + 1;
            const isCompleted = completed_steps.includes(idx);
            const isCurrent = stepNum === current_step;
            const isWatching = isCurrent && state === 'watching';
            const isConfirmed = isCurrent && state === 'confirmed';

            return (
              <div key={idx} className="relative">
                {/* Step circle */}
                {isCompleted ? (
                  <CheckCircle2
                    size={16}
                    className="text-green-400"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                ) : isCurrent ? (
                  <motion.div
                    animate={isWatching ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    {isConfirmed ? (
                      <CheckCircle2
                        size={16}
                        className="text-green-400"
                      />
                    ) : (
                      <Circle
                        size={16}
                        className={`${getStateColor(state)} ${isWatching ? 'animate-pulse' : ''}`}
                        fill="currentColor"
                        fillOpacity={0.3}
                      />
                    )}
                  </motion.div>
                ) : (
                  <Circle
                    size={16}
                    className="text-white/20"
                  />
                )}

                {/* Current step number overlay */}
                {isCurrent && !isCompleted && !isConfirmed && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white">
                    {stepNum}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Step counter text */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/60">
            Step <span className="text-white font-bold">{current_step}</span> of {total_steps}
          </span>

          {/* Attempt indicator (if multiple attempts) */}
          {attempt > 1 && state !== 'confirmed' && state !== 'complete' && (
            <span className="text-yellow-400 flex items-center gap-1">
              <AlertCircle size={10} />
              Try {attempt}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-mcai-accent to-green-400 rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${((completed_steps.length + (state === 'confirmed' ? 1 : 0)) / total_steps) * 100}%`
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Completion celebration */}
        {state === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 text-center"
          >
            <span className="text-green-400 text-[10px] font-bold">
              Pose Complete! Hold for photo!
            </span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
