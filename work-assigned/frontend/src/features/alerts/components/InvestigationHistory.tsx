import { AlertTriangle, CheckCircle, Clock, FileText, Lock, MessageSquare } from 'lucide-react';
import { formatRelativeTime } from '../../../lib/formatters';
import type { CaseAction } from '../../../types/alerts';

interface InvestigationHistoryProps {
  actions: CaseAction[];
}

export function InvestigationHistory({ actions }: InvestigationHistoryProps) {
  if (!actions || actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold/20 bg-canvas/40 p-4 text-center">
        <Clock className="mx-auto size-5 text-muted/60" aria-hidden />
        <p className="mt-1.5 text-xs font-medium text-muted">No investigation notes yet</p>
        <p className="mt-0.5 text-[11px] text-muted/70">
          Analyst decisions and notes will appear here in the immutable audit trail.
        </p>
      </div>
    );
  }

  const getActionBadge = (action: CaseAction['action']) => {
    switch (action) {
      case 'freeze':
        return {
          icon: Lock,
          label: 'Accounts Frozen',
          chip: 'border-emerald/40 bg-emerald/10 text-emerald',
        };
      case 'escalate':
        return {
          icon: AlertTriangle,
          label: 'Escalated',
          chip: 'border-danger/40 bg-danger/10 text-danger',
        };
      case 'false_positive':
        return {
          icon: CheckCircle,
          label: 'False Positive',
          chip: 'border-muted/40 bg-canvas/60 text-muted',
        };
      case 'note':
        return {
          icon: MessageSquare,
          label: 'Note Added',
          chip: 'border-gold/30 bg-gold/10 text-gold-light',
        };
      default:
        return {
          icon: FileText,
          label: 'Status Change',
          chip: 'border-gold/20 bg-canvas/40 text-ink/80',
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Investigation History & Audit Trail
        </h4>
        <span className="text-[11px] text-muted font-mono tabular-nums">
          {actions.length} {actions.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-px before:bg-gold/15">
        {actions.map((act) => {
          const badge = getActionBadge(act.action);
          const Icon = badge.icon;

          return (
            <div key={act.action_id} className="relative group">
              {/* Bullet circle */}
              <span
                className="absolute -left-6 top-1 grid size-5 place-items-center rounded-full border border-gold/30 bg-card shadow-xs text-gold-light"
                aria-hidden
              >
                <Icon className="size-2.5" />
              </span>

              <div className="rounded-xl border border-gold/10 bg-canvas/50 p-3 transition-colors hover:border-gold/25 hover:bg-canvas/80">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.chip}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs font-semibold text-ink">{act.actor}</span>
                  </div>
                  <span
                    className="text-[11px] text-muted font-mono"
                    title={new Date(act.ts).toUTCString()}
                  >
                    {formatRelativeTime(act.ts)}
                  </span>
                </div>

                {act.from_status && act.to_status && act.from_status !== act.to_status && (
                  <p className="mt-1.5 text-[11px] text-muted flex items-center gap-1.5">
                    Transition:
                    <span className="font-mono text-ink/80">{act.from_status}</span>
                    <span>&rarr;</span>
                    <span className="font-mono text-gold-light font-medium">{act.to_status}</span>
                  </p>
                )}

                {act.note && (
                  <p className="mt-2 text-xs leading-relaxed text-ink/90 bg-card/60 rounded-lg p-2 border border-gold/5">
                    {act.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
