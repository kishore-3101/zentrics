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

  return (
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
          {graph.pattern_tags.slice(0, 2).map((tag) => (
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
  );
}
