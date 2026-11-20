import { AlertTriangle, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { formatCount } from '../../../lib/formatters';
import type { AlertRecord } from '../../../types/alerts';

interface AlertKpiCardsProps {
  alerts: readonly AlertRecord[];
}

export function AlertKpiCards({ alerts }: AlertKpiCardsProps) {
  // Exact calculations adhering to v_alerts and cases.status definitions:
  const totalAlerts = alerts.length;
  const criticalAlerts = alerts.filter((a) => a.score >= 80).length;
  const underInvestigation = alerts.filter((a) => a.status === 'under_review').length;
  // Resolved alerts strictly follow false_positive resolution, distinct from frozen enforcement
  const resolvedAlerts = alerts.filter((a) => a.status === 'false_positive').length;
  const frozenCount = alerts.filter((a) => a.status === 'frozen').length;

  const cards = [
    {
      label: 'Total Alerts',
      icon: ShieldAlert,
      value: totalAlerts,
      description: 'Active alert records in v_alerts pipeline',
      accent: 'gold' as const,
      subtext: `${totalAlerts} ring clusters flagged`,
    },
    {
      label: 'Critical Alerts',
      icon: AlertTriangle,
      value: criticalAlerts,
      description: 'Severity score ≥ 80 requiring rapid action',
      accent: 'danger' as const,
      subtext: 'Immediate triage recommended',
    },
    {
      label: 'Under Investigation',
      icon: Search,
      value: underInvestigation,
      description: 'Cases actively being reviewed by analysts',
      accent: 'warning' as const,
      subtext: 'Assigned to operations team',
    },
    {
      label: 'Resolved Alerts',
      icon: CheckCircle2,
      value: resolvedAlerts,
      description: 'Cases investigated and closed as false positive',
      accent: 'emerald' as const,
      subtext: `${frozenCount} additional rings frozen`,
    },
  ];

  const ACCENTS = {
    gold: {
      chip: 'border-gold/35 bg-gold/10 text-gold-light',
    },
    danger: {
      chip: 'border-danger/35 bg-danger/10 text-danger',
    },
    warning: {
      chip: 'border-warning/35 bg-warning/10 text-warning',
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
            delay={idx * 0.06}
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
              <AnimatedNumber value={card.value} format={formatCount} delay={idx * 0.06} />
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
