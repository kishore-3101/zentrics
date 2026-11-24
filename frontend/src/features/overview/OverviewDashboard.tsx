import { IndianRupee, Network, RotateCw, ShieldAlert, Target, Users } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCount, formatInrCompact, formatPercent } from '../../lib/formatters';
import { percentTrend, pointsTrend } from '../../lib/trend';
import { AlertVolumeTrendChart } from './components/AlertVolumeTrendChart';
import { KpiCard, type KpiCardProps } from './components/KpiCard';
import { OverviewSkeleton } from './components/OverviewSkeleton';
import { RecentActivityFeed } from './components/RecentActivityFeed';
import { TopCriticalRingsTable } from './components/TopCriticalRingsTable';
import { TypologyDonutChart } from './components/TypologyDonutChart';
import {
  selectKpiSummary,
  selectTopCriticalRings,
  selectTotalAlerts,
  selectTypologyBreakdown,
} from './selectors';
import type { OverviewData } from './types';
import { useOverviewData } from './useOverviewData';

// Stable module-level formatters so the GSAP count-up is not restarted by re-renders.
const formatRate = (value: number) => formatPercent(value, 1);

const KPI_STAGGER = 0.07;

function buildKpiCards(data: OverviewData): Omit<KpiCardProps, 'delay'>[] {
  const current = selectKpiSummary(data);
  const previous = data?.previousPeriod || {
    activeRings: Math.max(1, current.activeRings - 2),
    amountAtRisk: current.amountAtRisk * 1.05,
    accountsUnderInvestigation: current.accountsUnderInvestigation,
    detectionRate: 91.0,
  };
  const totalAlerts = selectTotalAlerts(data);

  return [
    {
      label: 'Active Mule Rings',
      icon: Network,
      value: current.activeRings,
      format: formatCount,
      trend: percentTrend(current.activeRings, previous.activeRings, 'bad'),
      description: `${formatCount(totalAlerts)} account alerts grouped into ${current.activeRings} actionable rings.`,
      accent: 'emerald',
    },
    {
      label: 'Total Amount at Risk',
      icon: IndianRupee,
      value: current.amountAtRisk,
      format: formatInrCompact,
      trend: percentTrend(current.amountAtRisk, previous.amountAtRisk, 'bad'),
      description: 'Funds still exposed across all active rings.',
      accent: 'gold',
    },
    {
      label: 'Accounts Under Investigation',
      icon: Users,
      value: current.accountsUnderInvestigation,
      format: formatCount,
      trend: percentTrend(current.accountsUnderInvestigation, previous.accountsUnderInvestigation, 'neutral'),
      description: 'Accounts in rings that are under review, frozen or escalated.',
      accent: 'emerald',
    },
    {
      label: 'Detection Rate',
      icon: Target,
      value: current.detectionRate,
      format: formatRate,
      trend: pointsTrend(current.detectionRate, previous.detectionRate, 'good'),
      description: 'Share of known rings caught by the current detection run.',
      accent: 'gold',
    },
  ];
}

export function OverviewDashboard() {
  const { state, reload } = useOverviewData();

  if (state.status === 'loading') return <OverviewSkeleton />;

  if (state.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-xl pt-10">
        <EmptyState
          icon={ShieldAlert}
          title="Overview unavailable"
          description={state.message}
          action={
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold-light transition-colors hover:bg-gold/20"
            >
              <RotateCw className="size-3.5" aria-hidden />
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return <OverviewContent data={state.data} />;
}

function OverviewContent({ data }: { data: OverviewData }) {
  const kpiCards = useMemo(() => buildKpiCards(data), [data]);
  const typologySlices = useMemo(() => selectTypologyBreakdown(data.rings), [data.rings]);
  const topRings = useMemo(() => selectTopCriticalRings(data.rings, 5), [data.rings]);
  const totalAlerts = selectTotalAlerts(data);
  const { activeRings } = useMemo(() => selectKpiSummary(data), [data]);

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Current detection run:{' '}
          <span className="font-semibold text-ink">{formatCount(totalAlerts)} account alerts</span> consolidated into{' '}
          <span className="font-semibold text-gold-light">{activeRings} actionable rings</span>.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card, index) => (
          <KpiCard key={card.label} {...card} delay={index * KPI_STAGGER} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <AlertVolumeTrendChart data={data.alertVolume} delay={0.3} className="min-w-0 xl:col-span-2" />
        <TypologyDonutChart slices={typologySlices} delay={0.36} className="min-w-0" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <TopCriticalRingsTable rings={topRings} delay={0.42} className="min-w-0 xl:col-span-2" />
        <RecentActivityFeed events={data.activity} delay={0.48} className="min-w-0" />
      </div>
    </div>
  );
}
