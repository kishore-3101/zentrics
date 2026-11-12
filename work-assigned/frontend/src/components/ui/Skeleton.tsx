import { cn } from '../../lib/cn';

/** Loading placeholder block. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-card/80', className)} />;
}
