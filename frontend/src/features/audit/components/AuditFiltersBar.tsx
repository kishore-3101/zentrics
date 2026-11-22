import { RotateCcw, Search, ShieldCheck } from 'lucide-react';
import type { AuditFilterState } from '../../../types/cases';
import type { CaseAction } from '../../../types/alerts';

interface AuditFiltersBarProps {
  filters: AuditFilterState;
  onChange: (updater: (prev: AuditFilterState) => AuditFilterState) => void;
  onReset: () => void;
  isFiltered: boolean;
  totalCount: number;
  filteredCount: number;
}

const ACTION_OPTIONS: { id: CaseAction['action']; label: string }[] = [
  { id: 'freeze', label: 'Freeze' },
  { id: 'escalate', label: 'Escalate' },
  { id: 'false_positive', label: 'False Positive' },
  { id: 'note', label: 'Notes & Assignments' },
  { id: 'status_change', label: 'Status Changes' },
];

const ACTORS = [
  { id: 'all', label: 'All Actors' },
  { id: 'Operations Lead', label: 'Operations Lead' },
  { id: 'Lead AML Investigator', label: 'Lead AML Investigator' },
  { id: 'Senior AML Lead', label: 'Senior AML Lead' },
  { id: 'Automated Detection Engine', label: 'Automated Engine' },
];

export function AuditFiltersBar({
  filters,
  onChange,
  onReset,
  isFiltered,
  totalCount,
  filteredCount,
}: AuditFiltersBarProps) {
  const toggleAction = (action: CaseAction['action']) => {
    onChange((prev) => {
      const exists = prev.actions.includes(action);
      const next = exists
        ? prev.actions.filter((a) => a !== action)
        : [...prev.actions, action];
      return { ...prev, actions: next };
    });
  };

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/60 p-4 shadow-sm backdrop-blur-md space-y-3">
      {/* Top row: Search, Actor dropdown, Date preset */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            placeholder="Search audit trail by Action ID, Case #, Ring ID, or notes..."
            className="h-10 w-full rounded-xl border border-gold/20 bg-canvas/70 pl-10 pr-4 text-xs text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Actor Filter */}
          <div className="relative">
            <select
              value={filters.actor}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, actor: e.target.value }))
              }
              className="h-10 rounded-xl border border-gold/20 bg-canvas/80 px-3 py-1.5 text-xs text-ink focus:border-gold/60 focus:outline-none cursor-pointer"
            >
              {ACTORS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center rounded-xl border border-gold/20 bg-canvas/80 p-0.5">
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, datePreset: 'all' }))}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filters.datePreset === 'all'
                  ? 'bg-gold/20 text-gold-light'
                  : 'text-muted hover:text-ink'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, datePreset: 'today' }))}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filters.datePreset === 'today'
                  ? 'bg-gold/20 text-gold-light'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, datePreset: 'last_7_days' }))}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filters.datePreset === 'last_7_days'
                  ? 'bg-gold/20 text-gold-light'
                  : 'text-muted hover:text-ink'
              }`}
            >
              7 Days
            </button>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-xs font-medium text-gold-light hover:bg-gold/20 transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Action Type Pills & Total count */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gold/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
            Action:
          </span>
          {ACTION_OPTIONS.map((opt) => {
            const active = filters.actions.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleAction(opt.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-gold/60 bg-gold/20 text-gold-light font-semibold shadow-xs'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:border-gold/30 hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald" />
          <span>
            Displaying <strong className="text-ink">{filteredCount}</strong> of{' '}
            <strong className="text-ink">{totalCount}</strong> immutable records
          </span>
        </div>
      </div>
    </div>
  );
}
