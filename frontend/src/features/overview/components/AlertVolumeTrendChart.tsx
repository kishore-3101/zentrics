import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { cn } from '../../../lib/cn';
import { formatCount } from '../../../lib/formatters';
import { THEME } from '../../../lib/theme';
import { TYPOLOGY_META, TYPOLOGY_ORDER } from '../../../lib/typology';
import type { RingTypology } from '../../../types/ring';
import type { AlertVolumePoint } from '../types';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
}

function isTypology(key: unknown): key is RingTypology {
  return typeof key === 'string' && key in TYPOLOGY_META;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload
    .filter((entry): entry is TooltipEntry & { dataKey: RingTypology } => isTypology(entry.dataKey))
    .map((entry) => ({ typology: entry.dataKey, value: Number(entry.value ?? 0) }))
    .reverse(); // top of the stack first
  const total = (rows || []).reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="min-w-48 rounded-xl border border-gold/25 bg-sidebar/95 px-3.5 py-3 shadow-panel backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-light">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.typology} className="flex items-center justify-between gap-6 text-xs">
            <span className="text-muted">
              {TYPOLOGY_META[row.typology].label}
            </span>
            <span className="font-mono font-semibold tabular-nums text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 flex items-center justify-between border-t border-gold/15 pt-2 text-xs">
        <span className="text-muted">Total alerts</span>
        <span className="font-mono font-semibold tabular-nums text-gold-light">{total}</span>
      </p>
    </div>
  );
}

interface AlertVolumeTrendChartProps {
  data: readonly AlertVolumePoint[];
  delay?: number;
  className?: string;
}

export function AlertVolumeTrendChart({ data, delay = 0, className }: AlertVolumeTrendChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [hidden, setHidden] = useState<ReadonlySet<RingTypology>>(new Set());

  const visible = TYPOLOGY_ORDER.filter((typology) => !hidden.has(typology));
  const totalAlerts = useMemo(
    () => (data || []).reduce((sum, point) => sum + TYPOLOGY_ORDER.reduce((inner, typology) => inner + (point?.[typology] || 0), 0), 0),
    [data],
  );

  const toggle = (typology: RingTypology) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(typology)) {
        next.delete(typology);
      } else if (visible.length > 1) {
        next.add(typology); // always keep at least one series on screen
      }
      return next;
    });
  };

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <DashboardCard
      title="Alert Volume Trend"
      description={`${formatCount(totalAlerts)} alerts in this window, segmented by ring typology`}
      delay={delay}
      className={className}
      action={
        hasData ? (
          <div role="group" aria-label="Toggle ring typologies" className="flex max-w-md flex-wrap justify-end gap-1.5">
            {TYPOLOGY_ORDER.map((typology) => {
              const isOn = !hidden.has(typology);
              return (
                <button
                  key={typology}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggle(typology)}
                  className={cn(
                    'flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-200',
                    isOn ? 'border-gold/30 bg-gold/10 text-gold-light hover:border-gold/50' : 'border-white/10 text-muted/60 hover:border-white/25',
                  )}
                >
                  {TYPOLOGY_META[typology].label}
                </button>
              );
            })}
          </div>
        ) : null
      }
    >
      <div className="h-72 w-full min-w-0 overflow-hidden">
        {!hasData ? (
          <EmptyState
            icon={TrendingUp}
            title="No alert volume history"
            description="Alert volume timeline will populate as live transactions and rings are analyzed."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
            <AreaChart data={data as AlertVolumePoint[]} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <defs>
                {TYPOLOGY_ORDER.map((typology) => (
                  <linearGradient key={typology} id={`tm-trend-${typology}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TYPOLOGY_META[typology].color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={TYPOLOGY_META[typology].color} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(201,168,91,0.12)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tickLine={false}
                axisLine={false}
                tick={{ fill: THEME.muted, fontSize: 11 }}
                tickMargin={10}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: THEME.muted, fontSize: 11 }}
                width={44}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: THEME.goldLight, strokeOpacity: 0.35, strokeDasharray: '4 4' }}
              />
              {visible.map((typology) => (
                <Area
                  key={typology}
                  type="monotone"
                  dataKey={typology}
                  stackId="alerts"
                  stroke={TYPOLOGY_META[typology].color}
                  strokeWidth={1.75}
                  fill={`url(#tm-trend-${typology})`}
                  isAnimationActive={!reducedMotion}
                  animationDuration={900}
                  activeDot={{ r: 4, fill: TYPOLOGY_META[typology].color, stroke: THEME.canvas, strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </DashboardCard>
  );
}
