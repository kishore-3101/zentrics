import { Compass, Eye, EyeOff, Globe, Layers, MapPin, Search } from 'lucide-react';
import type { AccountRole } from '../../../types/ring-graph';

export type RingExplorerViewMode = 'google-earth' | '3d-canvas';

interface GraphControlsOverlayProps {
  showLabels: boolean;
  onToggleLabels: () => void;
  selectedRoles: Set<AccountRole>;
  onToggleRole: (role: AccountRole) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectPreset?: (preset: string) => void;
  viewMode?: RingExplorerViewMode;
  onViewModeChange?: (mode: RingExplorerViewMode) => void;
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
  onSelectPreset,
  viewMode = 'google-earth',
  onViewModeChange,
}: GraphControlsOverlayProps) {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
        {/* Search Input & View Mode Pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search account ID (e.g. ACC-9481)..."
              className="h-8 w-full rounded-xl border border-gold/25 bg-[#0B1812]/90 pl-8 pr-3 text-xs text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none backdrop-blur-md shadow-md"
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

          {/* View Mode Switcher: Google Earth vs 3D Canvas */}
          {onViewModeChange && (
            <div className="flex items-center rounded-xl border border-gold/30 bg-[#07110D]/95 p-0.5 shadow-md backdrop-blur-md">
              <button
                type="button"
                onClick={() => onViewModeChange('google-earth')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  viewMode === 'google-earth'
                    ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_10px_rgba(201,168,91,0.3)]'
                    : 'border border-transparent text-muted hover:text-ink'
                }`}
                title="Photorealistic Google Earth Satellite GIS"
              >
                <Globe className="size-3 text-emerald" />
                <span>Google Earth</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('3d-canvas')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  viewMode === '3d-canvas'
                    ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_10px_rgba(201,168,91,0.3)]'
                    : 'border border-transparent text-muted hover:text-ink'
                }`}
                title="Topological Force-Directed 3D Canvas"
              >
                <Layers className="size-3 text-gold-light" />
                <span>3D Canvas</span>
              </button>
            </div>
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
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors backdrop-blur-xs ${
                  active
                    ? 'border-gold/40 bg-gold/20 text-gold-light font-semibold'
                    : 'border-gold/10 bg-[#0B1812]/70 text-muted/60 hover:text-muted'
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
            className="inline-flex items-center gap-1 rounded-lg border border-gold/25 bg-[#0B1812]/85 px-2.5 py-1 text-[11px] font-medium text-gold-light hover:bg-gold/20 transition-colors backdrop-blur-xs"
          >
            {showLabels ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            <span>{showLabels ? 'Tags ON' : 'Tags OFF'}</span>
          </button>
        </div>
      </div>

      {/* Corridor Quick-Jump Presets */}
      {onSelectPreset && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted/70 mr-1 flex items-center gap-1">
            <Compass className="size-3 text-gold-light" /> Corridors:
          </span>
          <button
            type="button"
            onClick={() => onSelectPreset('overview')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            All India Overview
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('south')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            <MapPin className="size-2.5 text-emerald" /> Chennai → Bengaluru
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('mumbai')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            <MapPin className="size-2.5 text-gold-light" /> Mumbai Layering
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('kolkata')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            <MapPin className="size-2.5 text-danger" /> Kolkata Terminal Sink
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('north')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            Delhi / Jaipur
          </button>
          <button
            type="button"
            onClick={() => onSelectPreset('dubai')}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/75 px-2 py-0.5 text-[10px] font-medium text-muted hover:border-gold hover:text-gold-light transition-colors backdrop-blur-xs"
          >
            Dubai Offshore
          </button>
        </div>
      )}
    </div>
  );
}

export default GraphControlsOverlay;
