import { AnimatePresence, motion } from 'motion/react';
import { Copy, ExternalLink, Network, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import { fetchCaseActions, type CaseActionPayload } from '../../../services/alerts.service';
import type { AlertRecord, CaseAction } from '../../../types/alerts';
import { AlertActionCockpit } from './AlertActionCockpit';
import { AssigneeAvatar } from './AssigneeAvatar';
import { InvestigationHistory } from './InvestigationHistory';

interface AlertDetailsDrawerProps {
  alert: AlertRecord | null;
  onClose: () => void;
  onPerformAction: (payload: CaseActionPayload) => Promise<void>;
  isSubmitting: boolean;
}

export function AlertDetailsDrawer({
  alert,
  onClose,
  onPerformAction,
  isSubmitting,
}: AlertDetailsDrawerProps) {
  const [copiedFp, setCopiedFp] = useState(false);
  const [caseActions, setCaseActions] = useState<CaseAction[]>([]);

  useEffect(() => {
    if (!alert) return;

    let mounted = true;
    fetchCaseActions(alert.case_id)
      .then((actions) => {
        if (mounted) setCaseActions(actions);
      })
      .catch((err) => {
        console.error('Failed to load case actions:', err);
      });

    return () => {
      mounted = false;
    };
  }, [alert?.case_id, alert?.status, isSubmitting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  const copyFingerprint = () => {
    navigator.clipboard.writeText(alert.fingerprint);
    setCopiedFp(true);
    setTimeout(() => setCopiedFp(false), 2000);
  };

  const handleAction = async (payload: CaseActionPayload) => {
    await onPerformAction(payload);
    // Reload actions
    const fresh = await fetchCaseActions(alert.case_id);
    setCaseActions(fresh);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          key="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          aria-hidden
        />

        {/* Slide-over panel */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
          <motion.div
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="pointer-events-auto w-screen max-w-2xl border-l border-gold/20 bg-sidebar shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gold/15 px-6 py-4 bg-card/60">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold-light">
                  <Network className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-lg font-bold text-ink tracking-tight">
                      {alert.ring_id}
                    </h2>
                    <RingStatusPill status={alert.status} />
                  </div>
                  <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                    <span>Case #{alert.case_id}</span>
                    <span>&bull;</span>
                    <span>Detected {formatRelativeTime(alert.detected_at)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/rings/${encodeURIComponent(alert.ring_id)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors"
                >
                  <span>Open in Explorer</span>
                  <ExternalLink className="size-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close details"
                  className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* 1. Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gold/10 bg-card/40 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Risk Score
                  </span>
                  <div className="mt-1">
                    <RiskScoreMeter score={alert.score} />
                  </div>
                </div>

                <div className="rounded-xl border border-gold/10 bg-card/40 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Amount at Risk
                  </span>
                  <p className="mt-1 font-mono text-base font-semibold text-gold-light">
                    {formatInrCompact(alert.amount_at_risk)}
                  </p>
                  <p className="text-[10px] text-muted">
                    of {formatInrCompact(alert.amount_moved)} moved
                  </p>
                </div>

                <div className="rounded-xl border border-gold/10 bg-card/40 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Accounts
                  </span>
                  <p className="mt-1 font-mono text-base font-semibold text-ink">
                    {alert.n_accounts} total
                  </p>
                  <p className="text-[10px] text-emerald">
                    {alert.n_victims} victim accounts
                  </p>
                </div>

                <div className="rounded-xl border border-gold/10 bg-card/40 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Duration
                  </span>
                  <p className="mt-1 font-mono text-base font-semibold text-ink">
                    {alert.duration_min} mins
                  </p>
                  <p className="text-[10px] text-muted">active window</p>
                </div>
              </div>

              {/* 2. Typology & Assignee Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/15 bg-card/30 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-medium">Typology:</span>
                  <TypologyBadge typology={alert.ring_type} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-medium">Assignee:</span>
                  <AssigneeAvatar assignee={alert.assigned_to} size="md" />
                </div>
              </div>

              {/* 3. Risk Explanation & Key Evidence */}
              <div className="space-y-3 rounded-2xl border border-gold/15 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    SAR-Grade Risk Explanation
                  </h4>
                  <span className="text-[10px] font-semibold text-gold-light">
                    AI NARRATIVE ENGINE
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-ink/90 font-sans">
                  {alert.explanation || 'No detailed narrative generated for this alert.'}
                </p>

                {alert.key_evidence && alert.key_evidence.length > 0 && (
                  <div className="mt-3 border-t border-gold/10 pt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Key Evidence Facts
                    </span>
                    <ul className="mt-2 space-y-1.5 text-xs text-ink/80">
                      {alert.key_evidence.map((fact, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gold-light font-bold">&bull;</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pattern Badges */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gold/10">
                  {alert.pattern_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-gold/20 bg-canvas/60 px-2 py-0.5 font-mono text-[11px] text-gold-light"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 4. Account & Ring Structure */}
              <div className="space-y-3 rounded-2xl border border-gold/15 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Ring Member Entities
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
                    <span>FP:</span>
                    <span className="text-ink truncate max-w-[120px]">
                      {alert.fingerprint.slice(0, 12)}...
                    </span>
                    <button
                      type="button"
                      onClick={copyFingerprint}
                      title="Copy full fingerprint hash"
                      className="text-gold hover:text-gold-light ml-1"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    {copiedFp && <span className="text-[10px] text-emerald">Copied!</span>}
                  </div>
                </div>

                {alert.key_accounts && alert.key_accounts.length > 0 ? (
                  <div className="divide-y divide-gold/10">
                    {alert.key_accounts.map((acc) => (
                      <div
                        key={acc.account_id}
                        className="flex items-center justify-between py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-ink">
                            {acc.account_id}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              acc.role === 'collector'
                                ? 'bg-gold/20 text-gold-light border border-gold/30'
                                : acc.role === 'cash_out'
                                  ? 'bg-danger/20 text-danger border border-danger/30'
                                  : acc.role === 'mule'
                                    ? 'bg-warning/20 text-warning border border-warning/30'
                                    : 'bg-emerald/20 text-emerald border border-emerald/30'
                            }`}
                          >
                            {acc.role}
                          </span>
                        </div>
                        <span className="font-mono text-ink tabular-nums">
                          {formatInrCompact(acc.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    {alert.n_accounts} accounts mapped in graph topology. Click "Open in Explorer"
                    for interactive Cytoscape node visualizer.
                  </p>
                )}
              </div>

              {/* 5. Analyst Decision Cockpit */}
              <AlertActionCockpit
                alert={alert}
                onPerformAction={handleAction}
                isSubmitting={isSubmitting}
              />

              {/* 6. Investigation History */}
              <InvestigationHistory actions={caseActions} />
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
