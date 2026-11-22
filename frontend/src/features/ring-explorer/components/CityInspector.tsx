import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, MapPin, ShieldAlert, Users, X } from 'lucide-react';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { formatInrCompact } from '../../../lib/formatters';
import type { AccountNodeData } from '../../../types/ring-graph';
import type { GeoLocationNode } from '../types/geo';

interface CityInspectorProps {
  location: GeoLocationNode | null;
  onClose: () => void;
  onSelectAccount: (account: AccountNodeData) => void;
}

export function CityInspector({ location, onClose, onSelectAccount }: CityInspectorProps) {
  if (!location) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="city-inspector"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="absolute bottom-16 right-4 top-4 z-30 w-84 max-w-[90vw] overflow-y-auto rounded-2xl border border-gold/30 bg-card/95 p-5 shadow-2xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gold/15 pb-3">
          <div className="flex items-start gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold-light">
              <MapPin className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-base font-bold text-ink">{location.city}</h3>
              </div>
              <p className="text-[11px] text-muted">
                {location.state ? `${location.state}, ` : ''}{location.country}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close location inspector"
            className="rounded p-1 text-muted hover:text-ink transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Demo data provenance notice */}
        <div className="mt-2.5 rounded-lg border border-gold/15 bg-gold/5 px-2.5 py-1.5 text-[10px] text-gold-light/90 leading-tight">
          <strong>DEMO DATA:</strong> Synthetic geospatial projection based on account cluster metadata ({location.id}).
        </div>

        {/* Key Metrics Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-gold/10 bg-canvas/60 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Total Volume</span>
            <p className="mt-0.5 font-mono text-base font-bold text-gold-light tabular-nums">
              {formatInrCompact(location.totalAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-gold/10 bg-canvas/60 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Transactions</span>
            <p className="mt-0.5 font-mono text-base font-bold text-ink tabular-nums">
              {location.transactionCount} flows
            </p>
          </div>
        </div>

        {/* Flow Breakdown (Incoming vs Outgoing) */}
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-gold/10 bg-canvas/40 px-3 py-2 text-xs font-mono">
          <div>
            <span className="text-[10px] text-muted uppercase">Inflow: </span>
            <span className="text-emerald font-semibold">{formatInrCompact(location.totalIncoming)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted uppercase">Outflow: </span>
            <span className="text-danger font-semibold">{formatInrCompact(location.totalOutgoing)}</span>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="mt-3.5 rounded-xl border border-gold/15 bg-canvas/50 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <ShieldAlert className="size-3 text-gold-light" />
              Location Severity
            </span>
            <span className="font-mono text-xs font-bold text-gold-light">
              Avg {location.avgRiskScore}/100
            </span>
          </div>
          <RiskScoreMeter score={location.maxRiskScore} className="mt-2" />
        </div>

        {/* Associated Accounts Roster */}
        <div className="mt-4">
          <div className="flex items-center justify-between border-b border-gold/10 pb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Users className="size-3 text-emerald" />
              Associated Accounts ({location.accounts.length})
            </span>
          </div>

          <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {location.accounts.map((acc) => (
              <li
                key={acc.account_id}
                onClick={() => onSelectAccount(acc)}
                className="group flex items-center justify-between rounded-lg border border-gold/10 bg-canvas/30 px-2.5 py-1.5 text-xs hover:border-gold/30 hover:bg-gold/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-1.5 rounded-full ${
                      acc.role === 'victim'
                        ? 'bg-emerald'
                        : acc.role === 'cash_out'
                          ? 'bg-danger'
                          : 'bg-gold-light'
                    }`}
                  />
                  <div>
                    <p className="font-mono text-xs font-semibold text-ink group-hover:text-gold-light">
                      {acc.account_id}
                    </p>
                    <p className="text-[10px] text-muted capitalize">{acc.role.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-muted group-hover:text-gold-light">
                  <span className="font-mono text-[11px] tabular-nums font-medium">
                    Score {acc.risk_score}
                  </span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
