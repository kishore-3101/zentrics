import { AlertOctagon, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSimulation } from '../../features/simulation/useSimulation';
import { formatInrCompact } from '../../lib/formatters';

export function ActiveAttackAlertBanner() {
  const { activeAlert, dismissAlert } = useSimulation();

  if (!activeAlert) return null;

  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 rounded-xl border border-danger/50 bg-danger/15 px-4 py-3 shadow-lg backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-danger/50 bg-danger/25 text-danger animate-pulse">
          <AlertOctagon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-danger/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger border border-danger/40">
              CYBER THREAT DETECTED
            </span>
            <span className="font-mono text-xs font-bold text-gold-light">
              Ring {activeAlert.ring_id}
            </span>
          </div>
          <p className="text-xs text-ink/90 font-medium truncate mt-0.5">
            {activeAlert.scenario_name} · Volume: <strong className="text-emerald font-mono">{formatInrCompact(activeAlert.amount)}</strong>
            {activeAlert.blocked_info?.is_blocked && (
              <span className="ml-2 text-danger font-semibold">
                · AI Shield Active (Target {activeAlert.blocked_info.blocked_account} in {activeAlert.blocked_info.blocked_city} Frozen)
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/rings/${activeAlert.ring_id}?live=1`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold-light hover:bg-gold/30 transition-all cursor-pointer shadow-xs"
        >
          <span>Watch Live on Map</span>
          <ArrowRight className="size-3.5" />
        </Link>
        <button
          type="button"
          onClick={dismissAlert}
          className="grid size-7 place-items-center rounded-lg border border-white/10 text-muted hover:text-ink hover:bg-white/5 transition-colors cursor-pointer"
          title="Dismiss Alert"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default ActiveAttackAlertBanner;
