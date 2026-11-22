import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Fingerprint,
  Network,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import { fetchCaseActions } from '../../../services/alerts.service';
import type { CaseActionPayload } from '../../../services/alerts.service';
import type { AlertRecord, CaseAction } from '../../../types/alerts';
import type { CaseRecord } from '../../../types/cases';
import { AlertActionCockpit } from '../../alerts/components/AlertActionCockpit';
import { AssigneeAvatar } from '../../alerts/components/AssigneeAvatar';
import { InvestigationHistory } from '../../alerts/components/InvestigationHistory';

interface CaseDetailsDrawerProps {
  caseRecord: CaseRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onPerformAction: (caseRecord: CaseRecord, payload: CaseActionPayload) => Promise<void>;
  onOpenReassign: (caseRecord: CaseRecord) => void;
  isSubmitting: boolean;
}

export function CaseDetailsDrawer({
  caseRecord,
  isOpen,
  onClose,
  onPerformAction,
  onOpenReassign,
  isSubmitting,
}: CaseDetailsDrawerProps) {
  const [copiedFp, setCopiedFp] = useState(false);
  const [caseActions, setCaseActions] = useState<CaseAction[]>([]);

  useEffect(() => {
    if (!caseRecord) return;
    let mounted = true;
    fetchCaseActions(caseRecord.case_id)
      .then((actions) => {
        if (mounted) setCaseActions(actions);
      })
      .catch((err) => {
        console.error('Failed to load case actions:', err);
      });

    return () => {
      mounted = false;
    };
  }, [caseRecord?.case_id, caseRecord?.status, isSubmitting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyFingerprint = () => {
    if (!caseRecord) return;
    navigator.clipboard.writeText(caseRecord.fingerprint);
    setCopiedFp(true);
    setTimeout(() => setCopiedFp(false), 2000);
  };

  // Convert CaseRecord to AlertRecord so AlertActionCockpit can operate with full fidelity
  const adaptedAlert: AlertRecord | null = useMemo(() => {
    if (!caseRecord) return null;
    return {
      run_id: 1,
      ring_id: caseRecord.ring_id,
      fingerprint: caseRecord.fingerprint,
      ring_type: caseRecord.ring_type,
      score: caseRecord.score,
      priority: caseRecord.priority,
      amount_moved: caseRecord.amount_moved,
      amount_cashed: Math.max(0, caseRecord.amount_moved - caseRecord.amount_at_risk),
      amount_at_risk: caseRecord.amount_at_risk,
      duration_min: 42,
      n_accounts: caseRecord.n_accounts,
      n_victims: caseRecord.n_victims,
      pattern_tags: [caseRecord.ring_type],
      detected_at: caseRecord.created_at,
      case_id: caseRecord.case_id,
      status: caseRecord.status,
      assigned_to: caseRecord.assigned_to,
      case_notes: caseRecord.notes,
    };
  }, [caseRecord]);

  return (
    <AnimatePresence>
      {isOpen && caseRecord && adaptedAlert && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-gold/20 bg-card shadow-2xl backdrop-blur-xl sm:max-w-xl md:max-w-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold/15 bg-canvas/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg border border-gold/30 bg-gold/10 text-gold-light">
                  <ShieldAlert className="size-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-base font-bold text-ink">
                      Case #{caseRecord.case_id}
                    </h2>
                    <RingStatusPill status={caseRecord.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted">Ring ID:</span>
                    <Link
                      to={`/rings/${encodeURIComponent(caseRecord.ring_id)}`}
                      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-gold-light hover:underline"
                      title="Open in 3D Ring Explorer"
                    >
                      {caseRecord.ring_id}
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/rings/${encodeURIComponent(caseRecord.ring_id)}`}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors"
                >
                  <Network className="size-3.5" />
                  Explore 3D Ring
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Typology and Risk Level */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/15 bg-canvas/40 p-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Typology Archetype
                  </div>
                  <div className="mt-1">
                    <TypologyBadge typology={caseRecord.ring_type} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Composite Risk Score
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <RiskScoreMeter score={caseRecord.score} />
                  </div>
                </div>
              </div>

              {/* Financial Exposure KPI Matrix */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Amount Moved
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-ink">
                    {formatInrCompact(caseRecord.amount_moved)}
                  </p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Amount at Risk
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-gold-light">
                    {formatInrCompact(caseRecord.amount_at_risk)}
                  </p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Mule Accounts
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-ink">
                    {caseRecord.n_accounts}
                  </p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-canvas/50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Victims Involved
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold text-ink">
                    {caseRecord.n_victims}
                  </p>
                </div>
              </div>

              {/* Case Assignment & Timing Card */}
              <div className="rounded-xl border border-gold/15 bg-canvas/40 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gold/10 pb-2">
                  <span className="text-xs font-semibold text-muted">Assigned Investigator</span>
                  <button
                    type="button"
                    onClick={() => onOpenReassign(caseRecord)}
                    className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold-light hover:bg-gold/20"
                  >
                    <UserPlus className="size-3" />
                    Reassign
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AssigneeAvatar assignee={caseRecord.assigned_to} size="md" />
                    <div>
                      <p className="text-xs font-medium text-ink">
                        {caseRecord.assigned_to || 'Unassigned'}
                      </p>
                      <p className="text-[10px] text-muted">Lead Case Officer</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="flex items-center gap-1 text-muted">
                      <Clock className="size-3 text-gold-light" />
                      <span>Updated {formatRelativeTime(caseRecord.updated_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted/70 mt-0.5">
                      <Calendar className="size-2.5" />
                      <span>Created {new Date(caseRecord.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SHA-256 Fingerprint */}
              <div className="rounded-xl border border-gold/15 bg-canvas/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <Fingerprint className="size-3.5 text-gold-light" />
                    Cluster Topology Fingerprint
                  </span>
                  <button
                    type="button"
                    onClick={copyFingerprint}
                    className="inline-flex items-center gap-1 text-xs text-gold-light hover:underline"
                  >
                    {copiedFp ? (
                      <>
                        <Check className="size-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy SHA-256
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink/80 break-all select-all">
                  {caseRecord.fingerprint}
                </div>
              </div>

              {/* Case Action Cockpit */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Enforcement Action Cockpit
                </h3>
                <AlertActionCockpit
                  alert={adaptedAlert}
                  onPerformAction={(payload) => onPerformAction(caseRecord, payload)}
                  isSubmitting={isSubmitting}
                />
              </div>

              {/* Immutable Case Audit Trail */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Case Action History ({caseActions.length})
                </h3>
                <InvestigationHistory actions={caseActions} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
