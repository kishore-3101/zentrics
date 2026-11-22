import { RotateCcw, Search, UserCheck } from 'lucide-react';
import type { CaseFilterState } from '../../../types/cases';
import type { RingStatus } from '../../../types/ring';

interface CaseFiltersBarProps {
  filters: CaseFilterState;
  onChange: (updater: (prev: CaseFilterState) => CaseFilterState) => void;
  onReset: () => void;
  isFiltered: boolean;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { id: RingStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'false_positive', label: 'False Positive' },
];

const ANALYSTS = [
  { id: 'all', label: 'All Assignees' },
  { id: 'unassigned', label: 'Unassigned Only' },
  { id: 'P. Sharma', label: 'P. Sharma (Senior AML)' },
  { id: 'A. Verma', label: 'A. Verma (Analyst)' },
  { id: 'R. Iyer', label: 'R. Iyer (Specialist)' },
  { id: 'S. Nair', label: 'S. Nair (Analyst)' },
];

export function CaseFiltersBar({
  filters,
  onChange,
  onReset,
  isFiltered,
  totalCount,
  filteredCount,
}: CaseFiltersBarProps) {
  const toggleStatus = (status: RingStatus) => {
    onChange((prev) => {
      const exists = prev.statuses.includes(status);
      const next = exists
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: next };
    });
  };

  return (
    <div className="rounded-2xl border border-gold/15 bg-card/60 p-4 shadow-sm backdrop-blur-md space-y-3">
      {/* Top row: Search & Assignee select */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            placeholder="Search cases by Case #, Ring ID, notes, or analyst..."
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

        {/* Assignee Filter Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filters.assignee}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, assignee: e.target.value }))
              }
              className="h-10 rounded-xl border border-gold/20 bg-canvas/80 px-3 py-1.5 text-xs text-ink focus:border-gold/60 focus:outline-none cursor-pointer"
            >
              {ANALYSTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
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

      {/* Bottom row: Status Pills & Active Count */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gold/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
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
                    ? 'border-emerald/50 bg-emerald/15 text-emerald font-semibold shadow-xs'
                    : 'border-gold/15 bg-canvas/40 text-muted hover:border-gold/30 hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted flex items-center gap-1.5">
          <UserCheck className="size-3.5 text-gold-light" />
          <span>
            Showing <strong className="text-ink">{filteredCount}</strong> of{' '}
            <strong className="text-ink">{totalCount}</strong> cases
          </span>
        </div>
      </div>
    </div>
  );
}
