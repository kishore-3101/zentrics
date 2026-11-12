import { ArrowLeft, ChevronDown, Network } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import type { RingGraphData } from '../../../types/ring-graph';

interface RingExplorerHeaderProps {
  graph: RingGraphData;
}

const AVAILABLE_RINGS = ['R-104', 'R-089', 'R-097'];

export function RingExplorerHeader({ graph }: RingExplorerHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gold/15 pb-4">
      <div className="flex items-center gap-3">
        {/* Back to Alert Queue */}
        <Link
          to="/alerts"
          aria-label="Back to Alert Queue"
          className="grid size-9 place-items-center rounded-xl border border-gold/20 bg-card/60 text-muted hover:border-gold/50 hover:text-ink transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Network className="size-5 text-gold-light" />
              <h1 className="font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {graph.ring_id}
              </h1>
            </div>

            {/* Ring Switcher Dropdown */}
            <div className="relative inline-block">
              <select
                value={graph.ring_id}
                onChange={(e) => navigate(`/rings/${e.target.value}`)}
                className="appearance-none rounded-lg border border-gold/25 bg-canvas/80 py-0.5 pl-2 pr-6 font-mono text-xs font-semibold text-gold-light focus:border-gold focus:outline-none cursor-pointer"
              >
                {AVAILABLE_RINGS.map((rid) => (
                  <option key={rid} value={rid}>
                    {rid}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-gold-light" />
            </div>

            <TypologyBadge typology={graph.ring_type} />
            <RingStatusPill status={graph.status} />
            <StatusBadge tone="gold" size="sm" dot>
              Demo data
            </StatusBadge>
          </div>

          <p className="mt-1 text-xs text-muted flex items-center gap-2">
            <span>Duration: <strong className="font-mono text-ink">{graph.duration_min} mins</strong></span>
            <span>&bull;</span>
            <span>Fingerprint: <code className="font-mono text-gold-light text-[11px]">{graph.fingerprint.slice(0, 10)}...</code></span>
          </p>
        </div>
      </div>

      {/* Risk Meter on Right */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Aggregate Severity
          </span>
          <RiskScoreMeter score={graph.score} className="mt-1" />
        </div>
      </div>
    </div>
  );
}
