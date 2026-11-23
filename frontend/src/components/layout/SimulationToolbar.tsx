import { Check, ChevronDown, Pause, Play, RotateCcw, Sliders, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIMULATION_SPEEDS, type SimulationStatus } from '../../features/simulation/constants';
import { SimulationStudioModal } from '../../features/simulation/SimulationStudioModal';
import { useSimulation } from '../../features/simulation/useSimulation';
import { cn } from '../../lib/cn';
import { formatVirtualTime } from '../../lib/formatters';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

const STATUS_DISPLAY: Record<SimulationStatus, { label: string; tone: StatusTone }> = {
  running: { label: 'Running', tone: 'emerald' },
  paused: { label: 'Paused', tone: 'warning' },
  stopped: { label: 'Stopped', tone: 'neutral' },
};

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-gold/15" aria-hidden />;
}

/** Production simulation controls wired to backend streaming endpoints (Module 12d) */
export function SimulationToolbar() {
  const navigate = useNavigate();
  const {
    status,
    speed,
    elapsedSeconds,
    play,
    pause,
    reset,
    setSpeed,
    hasSavedConfig,
    isSimulating,
    runSimulation,
  } = useSimulation();

  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const isRunning = status === 'running';
  const isPristine = status === 'stopped' && elapsedSeconds === 0;
  const display = STATUS_DISPLAY[status];

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
    <div
      role="group"
      aria-label="Simulation controls"
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-gold/20 bg-card/60 p-1.5 sm:w-auto sm:justify-start"
    >
      <StatusBadge
        tone={display.tone}
        size="sm"
        dot
        pulse={isRunning}
        className="hidden sm:inline-flex"
      >
        {display.label}
      </StatusBadge>
      <Divider />

      <div className="flex items-center gap-1">
        <IconButton
          label="Play simulation"
          variant="emerald"
          size="sm"
          onClick={play}
          disabled={isRunning}
        >
          <Play className="size-3.5 fill-current" aria-hidden />
        </IconButton>
        <IconButton
          label="Pause simulation"
          variant="gold"
          size="sm"
          onClick={pause}
          disabled={!isRunning}
        >
          <Pause className="size-3.5 fill-current" aria-hidden />
        </IconButton>
        <IconButton
          label="Reset simulation"
          variant="outline"
          size="sm"
          onClick={reset}
          disabled={isPristine}
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <Divider />

      {/* Speed Selector */}
      <Popover
        align="start"
        panelLabel="Playback speed"
        panelClassName="w-32 p-1"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Playback speed ${speed}x`}
            title="Playback speed"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gold/20 px-2.5 text-xs font-semibold tabular-nums text-gold-light transition-colors duration-200 hover:border-gold/45 hover:bg-gold/5"
          >
            {speed}x
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        )}
      >
        {({ close }) => (
          <div role="listbox" aria-label="Playback speed">
            {SIMULATION_SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === speed}
                onClick={() => {
                  setSpeed(option);
                  close();
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm tabular-nums transition-colors duration-150 hover:bg-white/5',
                  option === speed ? 'text-gold-light' : 'text-ink/80',
                )}
              >
                {option}x
                {option === speed && <Check className="size-3.5 text-emerald" aria-hidden />}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <Divider />

      {/* Live Fraud Simulation Flow: Step 1 (Configure & Save) vs Step 2 (Simulate) */}
      {!hasSavedConfig ? (
        <button
          type="button"
          onClick={() => setIsStudioOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-3 text-xs font-semibold text-gold-light hover:border-gold hover:bg-gold/25 transition-all cursor-pointer shadow-xs"
          title="Configure Attack Scenario & Save Settings"
        >
          <Sliders className="size-3.5 text-gold-light" />
          <span className="hidden sm:inline">Simulate Attack</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          {/* Main Trigger: Simulate Button */}
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleExecuteSimulation}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald/50 bg-emerald/20 px-3 text-xs font-bold text-emerald hover:border-emerald hover:bg-emerald/30 transition-all cursor-pointer shadow-md disabled:opacity-50"
            title="Execute Live Simulated Attack & Watch in Ring Explorer"
          >
            {isSimulating ? (
              <>
                <span className="size-3 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Simulating...</span>
              </>
            ) : (
              <>
                <Zap className="size-3.5 fill-current text-emerald" />
                <span className="hidden sm:inline">Simulate</span>
              </>
            )}
          </button>

          {/* Edit Settings Button */}
          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex h-8 items-center justify-center rounded-lg border border-gold/30 bg-canvas/60 px-2 text-xs font-medium text-muted hover:border-gold/50 hover:text-ink transition-colors cursor-pointer"
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

      <Divider />

      {/* Virtual Time Indicator */}
      <div className="flex min-w-[6.5rem] flex-col items-end px-1.5 leading-none">
        <span className="text-[9px] font-medium tracking-[0.2em] text-muted">VIRTUAL TIME</span>
        <span
          role="timer"
          aria-label="Virtual time"
          className={cn(
            'mt-1 font-mono text-sm tabular-nums',
            isRunning ? 'text-gold-light' : 'text-ink/80',
          )}
        >
          {formatVirtualTime(elapsedSeconds)}
        </span>
      </div>
    </div>
  );
}

export default SimulationToolbar;
