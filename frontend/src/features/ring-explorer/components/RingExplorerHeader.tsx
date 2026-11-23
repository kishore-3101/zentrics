import { ArrowLeft, Box, ChevronDown, Compass, Network } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RingStatusPill } from '../../../components/ui/RingStatusPill';
import { RiskScoreMeter } from '../../../components/ui/RiskScoreMeter';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import type { RingGraphData } from '../../../types/ring-graph';
import { fetchAlerts } from '../../../services/alerts.service';

interface RingExplorerHeaderProps {
  graph: RingGraphData;
  viewMode: 'map' | 'canvas';
  onViewModeChange: (mode: 'map' | 'canvas') => void;
}

export function RingExplorerHeader({
  graph,
  viewMode,
  onViewModeChange,
}: RingExplorerHeaderProps) {
  const navigate = useNavigate();
  const [availableRings, setAvailableRings] = useState<string[]>([graph.ring_id]);

  useEffect(() => {
    fetchAlerts()
      .then((alerts) => {
        const ids = Array.from(new Set([graph.ring_id, ...alerts.map((a) => a.ring_id)])).sort();
        setAvailableRings(ids);
      })
      .catch(() => {
        setAvailableRings([graph.ring_id]);
      });
  }, [graph.ring_id]);

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
                className="appearance-none rounded-lg border border-gold/25 bg-canvas/80 py-0.5 pl-2 pr-6 font-mono text-xs font-semibold text-gold-light focus:border-gold focus:outline-none cursor-pointer max-w-[140px]"
              >
                {availableRings.map((rid) => (
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

      {/* Right: View Mode Slider (Maps | 3D Canvas) & Severity Meter */}
      <div className="flex items-center gap-4 self-end sm:self-auto">
        {/* View Mode Slider Segmented Pill */}
        <div className="flex items-center rounded-xl border border-gold/25 bg-canvas/90 p-1 shadow-md backdrop-blur-md">
          <button
            type="button"
            onClick={() => onViewModeChange('map')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'map'
                ? 'bg-gold/25 text-gold-light border border-gold/50 shadow-sm'
                : 'text-muted hover:text-ink border border-transparent hover:bg-gold/10'
            }`}
          >
            <Compass className="size-3.5 text-gold-light" />
            Maps
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('canvas')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === 'canvas'
                ? 'bg-gold/25 text-gold-light border border-gold/50 shadow-sm'
                : 'text-muted hover:text-ink border border-transparent hover:bg-gold/10'
            }`}
          >
            <Box className="size-3.5 text-gold-light" />
            3D Canvas
          </button>
        </div>

        {/* Severity Meter */}
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

export default RingExplorerHeader;
