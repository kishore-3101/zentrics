import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Skeleton } from '../components/ui/Skeleton';
import { ExportMetricsButton } from '../features/metrics/components/ExportMetricsButton';
import { FairnessBiasTable } from '../features/metrics/components/FairnessBiasTable';
import { FourWayComparisonChart } from '../features/metrics/components/FourWayComparisonChart';
import { InteractiveThresholdExplorer } from '../features/metrics/components/InteractiveThresholdExplorer';
import { MetricKpiCards } from '../features/metrics/components/MetricKpiCards';
import { OperationalImpactCard } from '../features/metrics/components/OperationalImpactCard';
import { PrRocCurvesChart } from '../features/metrics/components/PrRocCurvesChart';
import { TypologyDifficultyMatrix } from '../features/metrics/components/TypologyDifficultyMatrix';
import { useMetricsData } from '../features/metrics/hooks/useMetricsData';

export default function Metrics() {
  const { data, loading, error, refreshMetrics } = useMetricsData();
  const [selectedThreshold, setSelectedThreshold] = useState<number>(0.6);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Models &amp; Evaluation Benchmarks
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Empirical performance benchmarks, 4-way architectural comparison, PR/ROC curves, and fairness auditing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {data && <ExportMetricsButton data={data} />}

          <button
            type="button"
            onClick={refreshMetrics}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gold/25 bg-card/60 px-3 py-2 text-xs font-medium text-ink hover:bg-white/5 transition-colors"
            title="Refresh model benchmark metrics"
          >
            <RefreshCw className="size-3.5 text-gold-light" />
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-xs text-danger">
          <p className="font-semibold">Failed to load model evaluation metrics</p>
          <p className="mt-1 text-danger/80">{error}</p>
          <button
            type="button"
            onClick={refreshMetrics}
            className="mt-3 rounded-lg border border-danger/40 bg-danger/20 px-3 py-1.5 font-semibold text-danger hover:bg-danger/30"
          >
            Retry
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Section 1: Executive KPI Cards */}
          <ErrorBoundary fallbackTitle="Model KPIs Unavailable">
            <MetricKpiCards summary={data.overall} />
          </ErrorBoundary>

          {/* Section 2: Interactive Decision Threshold Calibration */}
          <ErrorBoundary fallbackTitle="Threshold Calibration Unavailable">
            <InteractiveThresholdExplorer
              prCurve={data.curves?.pr_curve || []}
              selectedThreshold={selectedThreshold}
              onThresholdChange={setSelectedThreshold}
            />
          </ErrorBoundary>

          {/* Section 3: Four-Way Comparison & PR/ROC Curves */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ErrorBoundary fallbackTitle="Model Comparison Chart Unavailable">
              <FourWayComparisonChart comparison={data.comparison || []} />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="PR/ROC Curves Unavailable">
              <PrRocCurvesChart
                prCurve={data.curves?.pr_curve || []}
                rocCurve={data.curves?.roc_curve || []}
                selectedThreshold={selectedThreshold}
                onSelectThreshold={setSelectedThreshold}
              />
            </ErrorBoundary>
          </div>

          {/* Section 4: Operational Impact & Alert Consolidation Funnel */}
          <ErrorBoundary fallbackTitle="Operational Impact Unavailable">
            <OperationalImpactCard impact={data.operationalImpact} />
          </ErrorBoundary>

          {/* Section 5: Typology Breakdown Matrix & Fairness Auditing */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ErrorBoundary fallbackTitle="Typology Matrix Unavailable">
              <TypologyDifficultyMatrix metrics={data.typologyBreakdown || []} />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Fairness Auditing Table Unavailable">
              <FairnessBiasTable records={data.fairness || []} />
            </ErrorBoundary>
          </div>
        </>
      )}
    </div>
  );
}
