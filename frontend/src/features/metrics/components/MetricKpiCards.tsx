import {
  Activity,
  CheckCircle2,
  Crosshair,
  Gauge,
  HelpCircle,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import type { MetricSummary } from '../../../types/metrics';

interface MetricKpiCardsProps {
  summary: MetricSummary;
}

const formatPercentVal = (v: number) => `${v.toFixed(1)}%`;
const formatAucVal = (v: number) => v.toFixed(3);

export function MetricKpiCards({ summary }: MetricKpiCardsProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const cards = [
    {
      label: 'Model Precision',
      value: summary.precision,
      format: formatPercentVal,
      icon: Crosshair,
      accent: 'emerald' as const,
      subtext: '+42.2 pp vs Baseline Rules (54.2%)',
      benchmarkLabel: 'High Confidence',
      definition: 'TP / (TP + FP) on held-out test split. Share of predicted mule accounts that are true positive mules.',
    },
    {
      label: 'Model Recall',
      value: summary.recall,
      format: formatPercentVal,
      icon: TrendingUp,
      accent: 'gold' as const,
      subtext: '+44.8 pp vs Baseline Rules (48.0%)',
      benchmarkLabel: 'Comprehensive Capture',
      definition: 'TP / (TP + FN) on held-out test split. Share of true positive mules detected across all 5 typologies.',
    },
    {
      label: 'F1-Score (Macro)',
      value: summary.f1,
      format: formatPercentVal,
      icon: Activity,
      accent: 'emerald' as const,
      subtext: '+43.7 pp vs Baseline Rules (50.9%)',
      benchmarkLabel: 'Optimal Balance',
      definition: '2 * (P * R) / (P + R). Harmonic mean of precision and recall balancing false alarms with missed mules.',
    },
    {
      label: 'PR-AUC Score',
      value: summary.pr_auc,
      format: formatAucVal,
      icon: Gauge,
      accent: 'gold' as const,
      subtext: '+0.479 vs Baseline Rules (0.492)',
      benchmarkLabel: 'Area Under PR Curve',
      definition: 'Area under Precision-Recall curve across all decision thresholds. Primary tuning metric for imbalanced fraud.',
    },
    {
      label: 'Ring Recall @ 70%',
      value: summary.ring_recall,
      format: formatPercentVal,
      icon: CheckCircle2,
      accent: 'emerald' as const,
      subtext: '+52.7 pp vs Baseline Rules (41.5%)',
      benchmarkLabel: 'Strict Threshold',
      definition: 'Share of ground-truth rings where at least 70% of member mule accounts are captured in a predicted ring cluster.',
    },
    {
      label: 'False Positive Rate',
      value: summary.fpr,
      format: formatPercentVal,
      icon: Percent,
      accent: 'gold' as const,
      subtext: '-16.6 pp vs Baseline Rules (18.4%)',
      benchmarkLabel: 'Low Fatigue',
      definition: 'FP / (FP + TN). Percentage of legitimate customer accounts erroneously flagged as mule intermediaries.',
    },
  ];

  const ACCENTS = {
    emerald: {
      chip: 'border-emerald/35 bg-emerald/10 text-emerald',
      border: 'hover:border-emerald/40',
    },
    gold: {
      chip: 'border-gold/35 bg-gold/10 text-gold-light',
      border: 'hover:border-gold/40',
    },
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, idx) => {
        const styles = ACCENTS[card.accent];
        const Icon = card.icon;
        const isTooltipOpen = activeTooltip === card.label;

        return (
          <DashboardCard
            key={card.label}
            interactive
            delay={idx * 0.04}
            bodyClassName={`relative p-4 overflow-hidden ${styles.border}`}
          >
            <div className="relative flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {card.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTooltip(isTooltipOpen ? null : card.label)}
                  className="text-muted/60 hover:text-gold-light transition-colors"
                  title="View formal evaluation definition"
                >
                  <HelpCircle className="size-3" />
                </button>
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg border ${styles.chip}`}>
                  <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                </span>
              </div>
            </div>

            <p className="relative mt-2 font-display text-2xl font-bold tracking-tight text-ink tabular-nums">
              <AnimatedNumber value={card.value} format={card.format} delay={idx * 0.04} />
            </p>

            <div className="relative mt-1 flex items-center justify-between text-[11px]">
              <span className="text-gold-light font-medium">{card.benchmarkLabel}</span>
            </div>

            <p className="relative mt-2 border-t border-gold/10 pt-1.5 text-[10px] text-muted leading-tight">
              {card.subtext}
            </p>

            {/* Definition Popover */}
            {isTooltipOpen && (
              <div className="absolute inset-0 z-20 flex flex-col justify-between rounded-xl bg-card/95 p-3.5 text-xs text-ink backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                <div>
                  <p className="font-semibold text-gold-light border-b border-gold/15 pb-1 text-[11px]">
                    {card.label} Definition
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
                    {card.definition}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(null)}
                  className="mt-2 self-end rounded px-2 py-0.5 text-[10px] font-semibold text-gold-light hover:bg-gold/15"
                >
                  Dismiss
                </button>
              </div>
            )}
          </DashboardCard>
        );
      })}
    </div>
  );
}
