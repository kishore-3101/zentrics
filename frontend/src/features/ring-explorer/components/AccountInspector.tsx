import { AnimatePresence, motion } from 'motion/react';
import { Building2, Calendar, CheckCircle2, ShieldAlert, User, X } from 'lucide-react';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { formatInrCompact } from '../../../lib/formatters';
import type { AccountNodeData } from '../../../types/ring-graph';

interface AccountInspectorProps {
  account: AccountNodeData | null;
  onClose: () => void;
}

const ROLE_LABELS: Record<AccountNodeData['role'], { label: string; badge: string }> = {
  victim: { label: 'Legitimate Victim', badge: 'bg-emerald/20 text-emerald border-emerald/30' },
  collector: { label: 'Aggregation Collector', badge: 'bg-gold/20 text-gold-light border-gold/30' },
  mule: { label: 'Layering Mule Conduit', badge: 'bg-warning/20 text-warning border-warning/30' },
  cash_out: { label: 'Terminal Cash-Out Sink', badge: 'bg-danger/20 text-danger border-danger/30' },
};

export function AccountInspector({ account, onClose }: AccountInspectorProps) {
  if (!account) return null;

  const roleMeta = ROLE_LABELS[account.role];

  return (
    <AnimatePresence>
      <motion.div
        key="account-inspector"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="absolute bottom-16 right-4 top-4 z-30 w-80 max-w-[90vw] overflow-y-auto rounded-2xl border border-gold/25 bg-card/90 p-5 shadow-2xl backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gold/15 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-ink">
                {account.account_id}
              </span>
            </div>
            <span
              className={`mt-1.5 inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleMeta.badge}`}
            >
              {roleMeta.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="rounded-lg p-1 text-muted hover:bg-white/5 hover:text-ink transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Fused Risk Score Gauge */}
        <div className="mt-4 rounded-xl border border-gold/15 bg-canvas/60 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>Fused Risk Score</span>
            <span className="font-mono text-gold-light">{Math.round(account.risk_score)} / 100</span>
          </div>
          <div className="mt-2">
            <RiskScoreMeter score={account.risk_score} />
          </div>

          {/* Sub-score Breakdown */}
          <div className="mt-3 grid grid-cols-3 gap-1 border-t border-gold/10 pt-2 text-[10px] text-muted">
            <div>
              <span>ML Prob</span>
              <p className="font-mono text-xs font-semibold text-ink">
                {account.ml_prob ? (account.ml_prob * 100).toFixed(0) : '85'}%
              </p>
            </div>
            <div>
              <span>Rule Score</span>
              <p className="font-mono text-xs font-semibold text-ink">
                {account.rule_score ? (account.rule_score * 100).toFixed(0) : '90'}%
              </p>
            </div>
            <div>
              <span>Neighbor Risk</span>
              <p className="font-mono text-xs font-semibold text-ink">
                {account.neighbor_risk ? (account.neighbor_risk * 100).toFixed(0) : '88'}%
              </p>
            </div>
          </div>
        </div>

        {/* Account Profile & KYC Attributes */}
        <div className="mt-4 space-y-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Account Profile
          </span>

          <div className="divide-y divide-gold/10 rounded-xl border border-gold/15 bg-canvas/40 px-3 py-1">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted flex items-center gap-1.5">
                <User className="size-3" /> Account Type
              </span>
              <span className="font-mono font-medium text-ink capitalize">
                {account.account_type || 'Savings'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted flex items-center gap-1.5">
                <CheckCircle2 className="size-3" /> KYC Level
              </span>
              <span className="font-mono font-medium text-ink uppercase">
                {account.kyc_level || 'Minimal'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted flex items-center gap-1.5">
                <Calendar className="size-3" /> Open Date
              </span>
              <span className="font-mono text-ink">
                {account.open_date || '2026-06-12'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted flex items-center gap-1.5">
                <Building2 className="size-3" /> Bank / Channel
              </span>
              <span className="font-mono text-ink">
                {account.bank_id || 'TRACE_BANK'}
              </span>
            </div>
          </div>
        </div>

        {/* Volume Handled */}
        <div className="mt-4 space-y-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Volume Handled
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-gold/10 bg-canvas/40 p-2.5">
              <span className="text-[10px] text-muted">Total Inflow</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald tabular-nums">
                {formatInrCompact(account.total_incoming)}
              </p>
            </div>
            <div className="rounded-xl border border-gold/10 bg-canvas/40 p-2.5">
              <span className="text-[10px] text-muted">Total Outflow</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-gold-light tabular-nums">
                {formatInrCompact(account.total_outgoing)}
              </p>
            </div>
          </div>
        </div>

        {/* SHAP Reason Codes */}
        {account.reason_codes && account.reason_codes.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <ShieldAlert className="size-3 text-gold" />
              SHAP Reason Codes
            </span>

            <div className="space-y-1.5">
              {account.reason_codes.map((rc) => (
                <div
                  key={rc.code}
                  className="rounded-lg border border-gold/10 bg-canvas/50 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink/90">{rc.label}</span>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        rc.direction === 'increases_risk' ? 'text-danger' : 'text-emerald'
                      }`}
                    >
                      {rc.weight > 0 ? `+${rc.weight}` : rc.weight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
