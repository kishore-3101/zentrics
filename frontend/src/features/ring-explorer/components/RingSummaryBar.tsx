import { Lock } from 'lucide-react';
import { formatInrCompact } from '../../../lib/formatters';
import type { RingGraphData } from '../../../types/ring-graph';

interface RingSummaryBarProps {
  graph: RingGraphData;
}

export function RingSummaryBar({ graph }: RingSummaryBarProps) {
  const victimCount = graph.nodes.filter((n) => n.role === 'victim').length;
  const collectorCount = graph.nodes.filter((n) => n.role === 'collector').length;
  const muleCount = graph.nodes.filter((n) => n.role === 'mule').length;
  const cashOutCount = graph.nodes.filter((n) => n.role === 'cash_out').length;

  const frozenNodes = graph.nodes.filter((n) => n.is_blocked || n.is_frozen);
  const blockedNode = frozenNodes[0];
  const isBlocked = Boolean(
    graph.blocked_info?.is_blocked ||
    graph.status === 'frozen' ||
    frozenNodes.length > 0,
  );

  const blockedAccount =
    graph.blocked_info?.blocked_account ||
    blockedNode?.account_id ||
    'Target Node';
  const frozenListLabel =
    frozenNodes.length > 1
      ? `${frozenNodes.length} ML-Detected Accounts Frozen (${frozenNodes.map((n) => n.account_id).join(', ')})`
      : `Account ${blockedAccount} (${graph.blocked_info?.blocked_city || blockedNode?.city || 'Regional Terminal'}) Quarantined`;
  const blockedReason =
    graph.blocked_info?.blocked_reason ||
    blockedNode?.blocked_reason ||
    'Autonomous freeze enforced by Zentrics ML Shield';
  const amountSaved =
    graph.blocked_info?.amount_saved ||
    (graph.amount_moved ? graph.amount_moved * 0.5 : 250000);

  return (
    <div className="space-y-2">
      {/* 1. Autonomous Defense & Freeze Alert Banner */}
      {isBlocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/15 px-4 py-2.5 text-xs shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded-md border border-danger/40 bg-danger/20 text-danger">
              <Lock className="size-3.5 fill-current" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-danger/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger border border-danger/40">
                AI Shield Freeze Triggered
              </span>
              <span className="text-ink font-semibold font-mono text-[11px] text-gold-light">
                {frozenListLabel}
              </span>
              <span className="hidden sm:inline text-muted">·</span>
              <span className="hidden md:inline text-xs text-ink/80 max-w-xl truncate" title={blockedReason}>
                {blockedReason}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Funds Intercepted:</span>
            <span className="font-mono text-xs font-bold text-emerald">
              {formatInrCompact(amountSaved)}
            </span>
          </div>
        </div>
      )}

      {/* 2. Core Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/15 bg-card/60 px-4 py-2.5 text-xs backdrop-blur-xs">
        {/* Node counts */}
        <div className="flex items-center gap-3">
          <span className="text-muted">
            Accounts: <strong className="font-mono text-ink">{graph.nodes.length}</strong>
          </span>
          <span className="text-emerald">
            {victimCount} Victims
          </span>
          <span className="text-gold-light">
            {collectorCount} Collectors
          </span>
          <span className="text-warning">
            {muleCount} Mules
          </span>
          <span className="text-danger">
            {cashOutCount} Sinks
          </span>
        </div>

        {/* Financials & Pattern tags */}
        <div className="flex items-center gap-4">
          <div>
            <span className="text-muted">Total Moved: </span>
            <span className="font-mono font-semibold text-ink">
              {formatInrCompact(graph.amount_moved)}
            </span>
          </div>

          <div>
            <span className="text-muted">At Risk: </span>
            <span className="font-mono font-semibold text-gold-light">
              {formatInrCompact(graph.amount_at_risk)}
            </span>
          </div>

          {/* Pattern tags */}
          <div className="hidden md:flex items-center gap-1">
            {graph.pattern_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-canvas/70 px-1.5 py-0.5 font-mono text-[10px] text-gold-light/90 border border-gold/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
