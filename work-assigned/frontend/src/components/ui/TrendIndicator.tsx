import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Trend, TrendDirection, TrendSentiment } from '../../lib/trend';

const SENTIMENT_STYLES: Record<TrendSentiment, string> = {
  good: 'bg-emerald/10 text-emerald',
  bad: 'bg-danger/10 text-danger',
  neutral: 'bg-gold/10 text-gold-light',
};

const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } satisfies Record<TrendDirection, unknown>;
const DIRECTION_WORD: Record<TrendDirection, string> = { up: 'Up', down: 'Down', flat: 'Unchanged' };

export function TrendIndicator({ trend, className }: { trend: Trend; className?: string }) {
  const Icon = DIRECTION_ICON[trend.direction];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        SENTIMENT_STYLES[trend.sentiment],
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{DIRECTION_WORD[trend.direction]} </span>
      {trend.label}
    </span>
  );
}
