import { Eye, EyeOff, Search } from 'lucide-react';
import type { AccountRole } from '../../../types/ring-graph';

interface GraphControlsOverlayProps {
  showLabels: boolean;
  onToggleLabels: () => void;
  selectedRoles: Set<AccountRole>;
  onToggleRole: (role: AccountRole) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ROLES: { id: AccountRole; label: string; color: string }[] = [
  { id: 'victim', label: 'Victims', color: '#00C878' },
  { id: 'collector', label: 'Collectors', color: '#C9A85B' },
  { id: 'mule', label: 'Mules', color: '#F59E0B' },
  { id: 'cash_out', label: 'Cash-out', color: '#EF4444' },
];

export function GraphControlsOverlay({
  showLabels,
  onToggleLabels,
  selectedRoles,
  onToggleRole,
  searchQuery,
  onSearchChange,
}: GraphControlsOverlayProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
      {/* Search Input */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find account in graph..."
          className="h-8 w-full rounded-xl border border-gold/20 bg-card/80 pl-8 pr-3 text-xs text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {/* Role filter toggles & Label switch */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ROLES.map((r) => {
          const active = selectedRoles.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onToggleRole(r.id)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-gold/40 bg-gold/20 text-gold-light'
                  : 'border-gold/10 bg-card/60 text-muted/60 hover:text-muted'
              }`}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: active ? r.color : '#8B9B8F' }}
              />
              {r.label}
            </button>
          );
        })}

        {/* Label Toggle */}
        <button
          type="button"
          onClick={onToggleLabels}
          title={showLabels ? 'Hide account tags' : 'Show account tags'}
          className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-card/75 px-2.5 py-1 text-[11px] font-medium text-gold-light hover:bg-gold/15 transition-colors"
        >
          {showLabels ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          <span>{showLabels ? 'Labels ON' : 'Labels OFF'}</span>
        </button>
      </div>
    </div>
  );
}
