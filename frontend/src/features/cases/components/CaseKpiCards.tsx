import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { formatCount } from '../../../lib/formatters';
import type { CaseRecord } from '../../../types/cases';

interface CaseKpiCardsProps {
  cases: CaseRecord[];
}

export function CaseKpiCards({ cases }: CaseKpiCardsProps) {
  const totalCases = cases.length;
  const inReview = cases.filter((c) => c.status === 'under_review').length;
  const escalated = cases.filter((c) => c.status === 'escalated').length;

  // Deriving resolution strictly from documented schema statuses:
  const falsePositives = cases.filter((c) => c.status === 'false_positive').length;
  const frozen = cases.filter((c) => c.status === 'frozen').length;
  const totalResolvedDispositions = falsePositives + frozen;

  const cards = [
    {
      label: 'Total Cases Tracked',
      icon: ShieldAlert,
      value: totalCases,
      description: 'Active cases mapped from detected mule rings',
      accent: 'gold' as const,
      subtext: `${totalCases} candidate rings under management`,
    },
    {
      label: 'In Active Review',
      icon: Clock,
      value: inReview,
      description: 'Cases currently assigned to investigators',
      accent: 'warning' as const,
      subtext: 'Undergoing investigative triage',
    },
    {
      label: 'Escalated to Senior AML',
      icon: AlertTriangle,
      value: escalated,
      description: 'Priority cases flagged for supervisor review',
      accent: 'danger' as const,
      subtext: 'High flight-risk of remaining funds',
    },
    {
      label: 'Enforced & Resolved',
      icon: CheckCircle2,
      value: totalResolvedDispositions,
      description: 'Documented final case determinations',
      accent: 'emerald' as const,
      subtext: `${frozen} frozen · ${falsePositives} dismissed as false positive`,
    },
  ];

  const ACCENTS = {
    gold: {
      chip: 'border-gold/35 bg-gold/10 text-gold-light',
    },
    warning: {
      chip: 'border-warning/35 bg-warning/10 text-warning',
    },
    danger: {
      chip: 'border-danger/35 bg-danger/10 text-danger',
    },
    emerald: {
      chip: 'border-emerald/35 bg-emerald/10 text-emerald',
    },
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, idx) => {
        const styles = ACCENTS[card.accent];
        const Icon = card.icon;

        return (
          <DashboardCard
            key={card.label}
            interactive
            delay={idx * 0.05}
            bodyClassName="relative p-5 overflow-hidden"
          >
            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {card.label}
              </p>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${styles.chip}`}>
                <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
            </div>

            <p className="relative mt-3 font-display text-3xl font-bold tracking-tight text-ink tabular-nums">
              <AnimatedNumber value={card.value} format={formatCount} delay={idx * 0.05} />
            </p>

            <div className="relative mt-2 flex items-center justify-between text-xs text-muted">
              <span>{card.description}</span>
            </div>

            <p className="relative mt-3 border-t border-gold/10 pt-2 text-[11px] text-muted/80">
              {card.subtext}
            </p>
          </DashboardCard>
        );
      })}
    </div>
  );
}
