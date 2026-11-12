import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { EASE_OUT } from '../../lib/motion';

function tierClasses(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: 'from-danger/60 to-danger', text: 'text-danger' };
  if (score >= 60) return { bar: 'from-gold to-gold-light', text: 'text-gold-light' };
  return { bar: 'from-emerald/60 to-emerald', text: 'text-emerald' };
}

interface RiskScoreMeterProps {
  /** 0-100 */
  score: number;
  className?: string;
}

/** Color-coded risk bar with numeric score (Module 13 shared component). */
export function RiskScoreMeter({ score, className }: RiskScoreMeterProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const tier = tierClasses(clamped);

  return (
    <div
      role="meter"
      aria-label="Risk score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('flex items-center gap-3', className)}
    >
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8">
        <motion.span
          className={cn('block h-full rounded-full bg-linear-to-r', tier.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.2 }}
        />
      </span>
      <span className={cn('w-7 font-mono text-sm font-semibold tabular-nums', tier.text)}>{Math.round(clamped)}</span>
    </div>
  );
}
