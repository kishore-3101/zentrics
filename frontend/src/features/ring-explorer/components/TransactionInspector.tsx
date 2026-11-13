import { ArrowRight, Clock, CreditCard, X } from 'lucide-react';
import { formatInrCompact, formatRelativeTime } from '../../../lib/formatters';
import type { TransactionEdgeData } from '../../../types/ring-graph';

interface TransactionInspectorProps {
  edge: TransactionEdgeData | null;
  onClose: () => void;
}

export function TransactionInspector({ edge, onClose }: TransactionInspectorProps) {
  if (!edge) return null;

  return (
    <div className="absolute bottom-20 left-4 z-30 w-72 rounded-2xl border border-gold/30 bg-card/90 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between border-b border-gold/15 pb-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Transaction Connection
          </span>
          <p className="font-mono text-xs font-bold text-gold-light">{edge.txn_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transaction inspector"
          className="rounded p-1 text-muted hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-2.5 text-xs">
        {/* Flow: Source -> Destination */}
        <div className="flex items-center justify-between rounded-lg border border-gold/10 bg-canvas/60 p-2">
          <span className="font-mono font-medium text-ink">{edge.src_account}</span>
          <ArrowRight className="size-3.5 text-gold-light" />
          <span className="font-mono font-medium text-ink">{edge.dst_account}</span>
        </div>

        {/* Amount & Channel */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gold/10 bg-canvas/40 p-2">
            <span className="text-[10px] text-muted">Amount</span>
            <p className="font-mono text-sm font-bold text-gold-light tabular-nums">
              {formatInrCompact(edge.amount)}
            </p>
          </div>
          <div className="rounded-lg border border-gold/10 bg-canvas/40 p-2">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <CreditCard className="size-2.5" /> Channel
            </span>
            <p className="font-mono text-xs font-semibold text-ink uppercase mt-0.5">
              {edge.channel}
            </p>
          </div>
        </div>

        {/* Timestamp & Hop Info */}
        <div className="flex items-center justify-between text-[11px] text-muted pt-1">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeTime(edge.ts)}
          </span>
          <span className="font-mono text-ink/80">Hop #{edge.hop_index}</span>
        </div>
      </div>
    </div>
  );
}
