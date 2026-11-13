import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Lock,
  MessageSquare,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatRelativeTime } from '../../../lib/formatters';
import type { AuditLogEntry } from '../../../types/cases';

interface AuditDetailModalProps {
  entry: AuditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailModal({ entry, isOpen, onClose }: AuditDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) return null;

  const getActionBadge = () => {
    switch (entry.action) {
      case 'freeze':
        return {
          icon: Lock,
          label: 'Accounts Frozen',
          chip: 'border-danger/40 bg-danger/10 text-danger',
        };
      case 'escalate':
        return {
          icon: AlertTriangle,
          label: 'Escalated to Supervisor',
          chip: 'border-warning/40 bg-warning/10 text-warning',
        };
      case 'false_positive':
        return {
          icon: CheckCircle,
          label: 'Marked False Positive',
          chip: 'border-muted/40 bg-muted/10 text-muted',
        };
      case 'status_change':
        return {
          icon: ArrowRight,
          label: 'Status Transition',
          chip: 'border-emerald/40 bg-emerald/10 text-emerald',
        };
      case 'note':
      default:
        return {
          icon: entry.note?.startsWith('Reassignment:') ? User : MessageSquare,
          label: entry.note?.startsWith('Reassignment:')
            ? 'Analyst Reassignment'
            : 'Investigation Note',
          chip: 'border-gold/40 bg-gold/10 text-gold-light',
        };
    }
  };

  const badge = getActionBadge();
  const Icon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-gold/30 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold/15 pb-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid size-9 place-items-center rounded-xl border ${badge.chip}`}
            >
              <Icon className="size-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink">
                  Audit Record #{entry.action_id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.chip}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-muted">
                Immutable compliance event logged in <code className="font-mono text-[11px] text-gold-light">case_actions</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-white/5 hover:text-ink transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Target Case & Ring
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gold-light">
                Case #{entry.case_id}
              </span>
              <span className="text-muted/60">&bull;</span>
              <Link
                to={`/rings/${encodeURIComponent(entry.ring_id)}`}
                className="inline-flex items-center gap-1 font-mono font-semibold text-ink hover:text-gold-light hover:underline"
              >
                {entry.ring_id}
                <ExternalLink className="size-3" />
              </Link>
            </div>
            <div className="pt-1">
              <TypologyBadge typology={entry.ring_type} />
            </div>
          </div>

          <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Author / Actor
            </span>
            <p className="font-medium text-ink flex items-center gap-1.5 pt-0.5">
              <User className="size-3.5 text-gold-light" />
              {entry.actor}
            </p>
            <p className="text-[10px] text-muted">Authorized Compliance Officer</p>
          </div>
        </div>

        {/* Timestamps */}
        <div className="rounded-xl border border-gold/15 bg-canvas/40 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5 text-gold-light" />
              Recorded Timestamp (UTC):
            </span>
            <span className="font-mono font-medium text-ink">{entry.ts}</span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-gold-light" />
              Local Time / Relative:
            </span>
            <span className="text-ink">
              {new Date(entry.ts).toLocaleString()} ({formatRelativeTime(entry.ts)})
            </span>
          </div>
        </div>

        {/* Status Transition (if applicable) */}
        {(entry.from_status || entry.to_status) && (
          <div className="rounded-xl border border-gold/15 bg-canvas/40 p-3 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Status State Transition
            </span>
            <div className="flex items-center gap-3">
              {entry.from_status ? (
                <RingStatusPill status={entry.from_status} />
              ) : (
                <span className="text-xs text-muted font-mono">initial</span>
              )}
              <ArrowRight className="size-4 text-gold-light shrink-0" />
              {entry.to_status ? (
                <RingStatusPill status={entry.to_status} />
              ) : (
                <span className="text-xs text-muted font-mono">none</span>
              )}
            </div>
          </div>
        )}

        {/* Logged Note / Rationale */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Investigator Notes & Audit Rationale
          </span>
          <div className="rounded-xl border border-gold/15 bg-canvas/60 p-3 text-xs leading-relaxed text-ink">
            {entry.note ? (
              <p className="whitespace-pre-wrap">{entry.note}</p>
            ) : (
              <span className="italic text-muted">No additional notes recorded for this action.</span>
            )}
          </div>
        </div>

        {/* Compliance Footer */}
        <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3 flex items-start gap-2.5 text-[11px] text-muted">
          <Shield className="size-4 text-emerald shrink-0 mt-0.5" />
          <p>
            <strong className="text-emerald font-semibold">Regulatory Audit Trail:</strong> This record is immutable and cryptographically bound to the pipeline run under RBI Master Directions on AML/CFT & PMLA statutory retention rules.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-2 border-t border-gold/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
