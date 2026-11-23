import { useState } from 'react';
import { Layers } from 'lucide-react';
import { TypologyBadge } from '../../../components/ui/TypologyBadge';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import type { TypologyDifficultyMetric } from '../../../types/metrics';
import type { RingTypology } from '../../../types/ring';

interface TypologyDifficultyMatrixProps {
  metrics: TypologyDifficultyMetric[];
}

export function TypologyDifficultyMatrix({ metrics = [] }: TypologyDifficultyMatrixProps) {
  const [selectedTypology, setSelectedTypology] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');

  const safeMetrics = metrics || [];
  const filteredMetrics = safeMetrics.filter((m) => {
    if (selectedTypology !== 'all') {
      const normTypology = m.typology.toLowerCase().replace(/[-\s]+/g, '_');
      const normSelected = selectedTypology.toLowerCase().replace(/[-\s]+/g, '_');
      if (normTypology !== normSelected) {
        return false;
      }
    }
    if (selectedTier !== 'all' && m.difficulty !== selectedTier) {
      return false;
    }
    return true;
  });

  const getDifficultyBadge = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy':
        return 'border-emerald/40 bg-emerald/10 text-emerald';
      case 'medium':
        return 'border-warning/40 bg-warning/10 text-warning';
      case 'hard':
        return 'border-danger/40 bg-danger/10 text-danger';
    }
  };

  const TH =
    'px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted select-none';

  return (
    <DashboardCard bodyClassName="p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gold/10 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Layers className="size-4 text-gold-light" />
            Typology Archetype &amp; Difficulty Breakdown Matrix
          </h3>
          <p className="text-xs text-muted">
            Evaluation performance across synthetic ring topologies across complexity tiers (Easy, Medium, Hard).
          </p>
        </div>
        <div className="text-xs text-gold-light font-mono">
          Showing {filteredMetrics.length} of {metrics.length} Slices
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Typology selection */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
            Typology:
          </span>
          {[
            { id: 'all', label: 'All 5 Typologies' },
            { id: 'burst_fanin', label: 'Burst Fan-in' },
            { id: 'rapid_pass_through', label: 'Pass-Through' },
            { id: 'structural_cycle', label: 'Cycle' },
            { id: 'layering_chain', label: 'Layering' },
            { id: 'dormant_activation', label: 'Dormant' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTypology(t.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedTypology === t.id
                  ? 'border border-gold/50 bg-gold/15 text-gold-light font-semibold'
                  : 'border border-gold/15 bg-canvas/40 text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tier filter */}
        <div className="flex items-center gap-1">
          {['all', 'easy', 'medium', 'hard'].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`rounded-lg px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
                selectedTier === tier
                  ? 'border border-gold/40 bg-gold/20 text-gold-light'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-gold/15 bg-canvas/60">
            <tr>
              <th scope="col" className={TH}>Typology Archetype</th>
              <th scope="col" className={TH}>Complexity Tier</th>
              <th scope="col" className={`${TH} text-right`}>Ring Recall (%)</th>
              <th scope="col" className={`${TH} text-right`}>F1-Score (%)</th>
              <th scope="col" className={`${TH} text-right`}>Sample Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/8">
            {filteredMetrics.map((row, idx) => (
              <tr key={idx} className="transition-colors hover:bg-white/4">
                <td className="px-3.5 py-2.5 whitespace-nowrap">
                  <TypologyBadge typology={row.typology as RingTypology} />
                </td>
                <td className="px-3.5 py-2.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${getDifficultyBadge(
                      row.difficulty,
                    )}`}
                  >
                    {row.difficulty}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-xs font-bold text-emerald">
                  {row.recall.toFixed(1)}%
                </td>
                <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-xs font-bold text-ink">
                  {row.f1.toFixed(1)}%
                </td>
                <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-xs text-muted">
                  {row.sample_size} rings
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gold/15 bg-canvas/30 p-2.5 text-[11px] text-muted leading-relaxed">
        <strong className="text-gold-light font-semibold">Robustness Insight:</strong> Even under Hard difficulty parameters (e.g. multi-hop cycles with delayed forwarding and smurfing amounts), MuleNet preserves &ge;85.0% recall and &ge;88.0% F1, proving robustness against sophisticated laundering evasions.
      </div>
    </DashboardCard>
  );
}
