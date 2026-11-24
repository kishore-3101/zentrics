import { Sliders, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationStudioModal } from '../../features/simulation/SimulationStudioModal';
import { useSimulation } from '../../features/simulation/useSimulation';

/** Sleek Simulate Attack trigger button */
export function SimulationToolbar() {
  const navigate = useNavigate();
  const {
    hasSavedConfig,
    isSimulating,
    runSimulation,
  } = useSimulation();

  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const handleExecuteSimulation = async () => {
    try {
      const res = await runSimulation();
      if (res && res.ring_id) {
        navigate(`/rings/${res.ring_id}?live=1`);
      }
    } catch (err) {
      console.error('Failed to run attack simulation:', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!hasSavedConfig ? (
        <button
          type="button"
          onClick={() => setIsStudioOpen(true)}
          className="flex h-9 items-center gap-2 rounded-xl border border-gold/40 bg-gold/15 px-3.5 text-xs font-semibold text-gold-light hover:border-gold hover:bg-gold/25 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Configure Attack Scenario & Save Settings"
        >
          <Sliders className="size-3.5 text-gold-light" />
          <span>Simulate Attack</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleExecuteSimulation}
            className="flex h-9 items-center gap-2 rounded-xl border border-emerald/50 bg-emerald/20 px-3.5 text-xs font-bold text-emerald hover:border-emerald hover:bg-emerald/30 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
            title="Execute Live Simulated Attack & Watch in Ring Explorer"
          >
            {isSimulating ? (
              <>
                <span className="size-3.5 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Zap className="size-3.5 fill-current text-emerald" />
                <span>Simulate</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex h-9 items-center justify-center rounded-xl border border-gold/30 bg-card/60 px-2.5 text-xs font-medium text-muted hover:border-gold/50 hover:text-ink transition-colors cursor-pointer"
            title="Edit Attack Settings"
          >
            <Sliders className="size-3.5 text-gold-light" />
          </button>
        </div>
      )}

      <SimulationStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
      />
    </div>
  );
}

export default SimulationToolbar;
