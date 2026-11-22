import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { TYPOLOGY_META, TYPOLOGY_ORDER } from '../../../lib/typology';
import type { AlertFilterState } from '../../../types/alerts';
import type { RingStatus, RingTypology } from '../../../types/ring';

interface AlertFiltersBarProps {
  filters: AlertFilterState;
  onChange: (updater: (prev: AlertFilterState) => AlertFilterState) => void;
  onReset: () => void;
  isFiltered: boolean;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { id: RingStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'under_review', label: 'Under review' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'false_positive', label: 'False positive' },
];

const AMOUNT_PRESETS: { id: AlertFilterState['amountPreset']; label: string }[] = [
  { id: 'all', label: 'Any Amount' },
  { id: 'above_500k', label: '> ₹5L' },
  { id: 'above_1m', label: '> ₹10L' },
  { id: 'above_2m', label: '> ₹20L' },
];

const DATE_PRESETS: { id: AlertFilterState['datePreset']; label: string }[] = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today (24h)' },
  { id: 'last_7_days', label: 'Last 7 Days' },
];

export function AlertFiltersBar({
  filters,
  onChange,
  onReset,
  isFiltered,
  totalCount,
  filteredCount,
}: AlertFiltersBarProps) {
  const toggleStatus = (status: RingStatus) => {
    onChange((prev) => {
      const exists = prev.statuses.includes(status);
      const nextStatuses = exists
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: nextStatuses };
    });
  };

  const toggleTypology = (typology: RingTypology) => {
    onChange((prev) => {
      const exists = prev.typologies.includes(typology);
      const next = exists
        ? prev.typologies.filter((t) => t !== typology)
        : [...prev.typologies, typology];
      return { ...prev, typologies: next };
    });
  };

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/60 p-4 shadow-sm backdrop-blur-md space-y-4">
      {/* Top row: Search input + Results summary + Reset action */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            placeholder="Search by Ring ID (e.g. R-104), Assignee, notes, or fingerprint..."
            className="h-10 w-full rounded-xl border border-gold/20 bg-canvas/70 pl-10 pr-4 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-gold/60 focus:bg-canvas focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, searchQuery: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-2 text-xs text-muted">
            <SlidersHorizontal className="size-3.5 text-gold" aria-hidden />
            <span>
              Showing <strong className="font-semibold text-ink">{filteredCount}</strong> of{' '}
              <strong className="font-semibold text-ink">{totalCount}</strong> alerts
            </span>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold-light transition-colors hover:bg-gold/20"
            >
              <RotateCcw className="size-3" aria-hidden />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Middle row: Typology & Status multi-select tags */}
      <div className="flex flex-col gap-3 border-t border-gold/10 pt-3">
        {/* Typologies */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1.5">
            Typology:
          </span>
          {TYPOLOGY_ORDER.map((type) => {
            const meta = TYPOLOGY_META[type];
            const active = filters.typologies.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleTypology(type)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-gold-light bg-gold/20 text-gold-light shadow-sm'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:border-gold/30 hover:text-ink'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Statuses */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1.5">
            Status:
          </span>
          {STATUS_OPTIONS.map((opt) => {
            const active = filters.statuses.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleStatus(opt.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-emerald/50 bg-emerald/15 text-emerald font-semibold shadow-sm'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:border-gold/30 hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Risk Score Slider, Amount Preset, Date Preset */}
      <div className="grid gap-4 border-t border-gold/10 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Min Risk Score slider */}
        <div className="flex flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted">Min Risk Score</span>
            <span className="font-mono font-semibold text-gold-light tabular-nums">
              ≥ {filters.minRiskScore}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={filters.minRiskScore}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                minRiskScore: Number(e.target.value),
              }))
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-canvas accent-gold"
          />
        </div>

        {/* Amount at risk presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Amount at Risk</span>
          <div className="flex items-center gap-1">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, amountPreset: preset.id }))
                }
                className={`flex-1 rounded-lg border py-1 text-center text-xs font-medium transition-colors ${
                  filters.amountPreset === preset.id
                    ? 'border-gold/50 bg-gold/20 text-gold-light font-semibold'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date window presets */}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-muted">Detection Date</span>
          <div className="flex items-center gap-1">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, datePreset: preset.id }))
                }
                className={`flex-1 rounded-lg border py-1 text-center text-xs font-medium transition-colors ${
                  filters.datePreset === preset.id
                    ? 'border-gold/50 bg-gold/20 text-gold-light font-semibold'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
