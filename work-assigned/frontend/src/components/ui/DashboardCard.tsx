import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { EASE_OUT } from '../../lib/motion';

interface DashboardCardProps {
  title?: string;
  description?: string;
  /** Right-aligned slot in the header (badges, links, legend toggles). */
  action?: ReactNode;
  /** Entrance delay in seconds, for staggering a row of cards. */
  delay?: number;
  /** Lift and glow on hover (use for clickable-feeling summary cards). */
  interactive?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Standard dashboard surface: #10251B card, gold hairline, Motion entrance. */
export function DashboardCard({
  title,
  description,
  action,
  delay = 0,
  interactive = false,
  className,
  bodyClassName,
  children,
}: DashboardCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gold/15 bg-linear-to-b from-card to-[#0d2018] shadow-panel transition-[border-color,box-shadow] duration-300',
        interactive && 'hover:border-gold/35 hover:shadow-glow-gold',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent"
      />
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1 p-5', bodyClassName)}>{children}</div>
    </motion.section>
  );
}
