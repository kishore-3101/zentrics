import { Layers } from 'lucide-react';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { cn } from '../../../lib/cn';
import { formatPercent } from '../../../lib/formatters';
import type { TypologySlice } from '../types';

interface TypologyDonutChartProps {
  slices: readonly TypologySlice[];
  delay?: number;
  className?: string;
}

export function TypologyDonutChart({ slices, delay = 0, className }: TypologyDonutChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalRings = slices.reduce((sum, slice) => sum + slice.count, 0);
  const active = activeIndex === null ? null : slices[activeIndex];

  return (
    <DashboardCard
      title="Ring Typology Breakdown"
      description="Share of active rings by detected pattern"
      delay={delay}
      className={className}
    >
      {slices.length === 0 ? (
        <EmptyState icon={Layers} title="No active rings" description="Typology distribution appears once rings are detected." />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="relative mx-auto h-52 w-full max-w-[13rem]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices as TypologySlice[]}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="96%"
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={!reducedMotion}
                  animationDuration={1000}
                  onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {slices.map((slice, index) => (
                    <Cell
                      key={slice.typology}
                      fill={slice.color}
                      stroke="none"
                      fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                      style={{ transition: 'fill-opacity 200ms ease', outline: 'none' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums text-ink">{active ? active.count : totalRings}</p>
                <p className="mt-0.5 max-w-24 text-[10px] font-medium uppercase leading-tight tracking-[0.16em] text-muted">
                  {active ? active.label : 'Active rings'}
                </p>
              </div>
            </div>
          </div>

          <ul className="space-y-1" aria-label="Typology counts">
            {slices.map((slice, index) => (
              <li
                key={slice.typology}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200',
                  activeIndex === index ? 'bg-white/5' : 'bg-transparent',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink/90">{slice.label}</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-ink">{slice.count}</span>
                <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">{formatPercent(slice.percent)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
