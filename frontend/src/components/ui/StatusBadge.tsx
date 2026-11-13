import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type StatusTone = 'emerald' | 'gold' | 'danger' | 'warning' | 'neutral';

const TONES: Record<StatusTone, { badge: string; dot: string }> = {
  emerald: { badge: 'border-emerald/30 bg-emerald/10 text-emerald', dot: 'bg-emerald' },
  gold: { badge: 'border-gold/35 bg-gold/10 text-gold-light', dot: 'bg-gold' },
  danger: { badge: 'border-danger/35 bg-danger/10 text-danger', dot: 'bg-danger' },
  warning: { badge: 'border-warning/35 bg-warning/10 text-warning', dot: 'bg-warning' },
  neutral: { badge: 'border-white/10 bg-white/5 text-muted', dot: 'bg-muted' },
};

const SIZES = {
  sm: 'h-5 gap-1.5 px-2 text-[10px]',
  md: 'h-6 gap-2 px-2.5 text-xs',
} as const;

interface StatusBadgeProps {
  tone?: StatusTone;
  size?: keyof typeof SIZES;
  /** Show a leading status dot. */
  dot?: boolean;
  /** Pulse the dot (only meaningful with `dot`). */
  pulse?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function StatusBadge({
  tone = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  title,
  className,
  children,
}: StatusBadgeProps) {
  const styles = TONES[tone];

  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold uppercase tracking-wider',
        SIZES[size],
        styles.badge,
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5" aria-hidden>
          {pulse && (
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', styles.dot)} />
          )}
          <span className={cn('relative inline-flex size-1.5 rounded-full', styles.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
