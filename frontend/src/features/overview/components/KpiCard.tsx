import type { LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { TrendIndicator } from '../../../components/ui/TrendIndicator';
import { cn } from '../../../lib/cn';
import type { Trend } from '../../../lib/trend';

export interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  value: number;
  /** Stable formatter (module-level), used by the count-up. */
  format: (value: number) => string;
  trend: Trend;
  description: string;
  accent?: 'emerald' | 'gold';
  /** Entrance / count-up delay in seconds. */
  delay?: number;
}

const ACCENTS = {
  emerald: {
    chip: 'border-emerald/30 bg-emerald/10 text-emerald',
    glow: 'bg-[radial-gradient(circle,rgb(0_200_120/0.16),transparent_65%)]',
  },
  gold: {
    chip: 'border-gold/35 bg-gold/10 text-gold-light',
    glow: 'bg-[radial-gradient(circle,rgb(201_168_91/0.18),transparent_65%)]',
  },
} as const;

export function KpiCard({ label, icon: Icon, value, format, trend, description, accent = 'emerald', delay = 0 }: KpiCardProps) {
  const styles = ACCENTS[accent];

  return (
    <DashboardCard interactive delay={delay} bodyClassName="relative">
      <div aria-hidden className={cn('pointer-events-none absolute -right-14 -top-14 size-44', styles.glow)} />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl border', styles.chip)}>
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
      </div>

      <p className="relative mt-4 font-display text-4xl font-bold tracking-tight text-ink tabular-nums">
        <AnimatedNumber value={value} format={format} delay={delay} />
      </p>

      <div className="relative mt-4 flex items-center gap-2">
        <TrendIndicator trend={trend} />
        <span className="text-xs text-muted">vs previous period</span>
      </div>
      <p className="relative mt-3 border-t border-gold/10 pt-3 text-xs leading-relaxed text-muted">{description}</p>
    </DashboardCard>
  );
}
