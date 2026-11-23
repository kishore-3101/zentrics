import { Check, ChevronDown, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { useState } from 'react';
import { SIMULATION_SPEEDS, type SimulationStatus } from '../../features/simulation/constants';
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

function InjectRingForm({
  onClose,
  onInject,
}: {
  onClose: () => void;
  onInject?: (typology?: string, difficulty?: string, amount?: number) => Promise<any>;
}) {
  const [typology, setTypology] = useState('circular_flow');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [injectedId, setInjectedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onInject) return;
    setLoading(true);
    try {
      const res = await onInject(typology, difficulty);
      if (res && res.ring_id) {
        setInjectedId(res.ring_id);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between border-b border-gold/15 pb-2">
        <span className="font-mono text-xs font-bold text-gold-light flex items-center gap-1.5">
          <Zap className="size-3.5 text-danger fill-current" /> Live Ring Injector
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted hover:text-ink cursor-pointer"
        >
          ✕
        </button>
      </div>

      {injectedId ? (
        <div className="rounded-lg bg-emerald/10 border border-emerald/30 p-2 text-center text-xs font-semibold text-emerald">
          ✓ Injected {injectedId}! Alert published.
        </div>
      ) : (
        <>
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted block mb-1">
              Ring Typology
            </label>
            <select
              value={typology}
              onChange={(e) => setTypology(e.target.value)}
              className="w-full rounded-lg border border-gold/25 bg-[#07110D] px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none"
            >
              <option value="circular_flow">Circular Flow (Cycles)</option>
              <option value="fan_in_burst">Fan-In Burst (Aggregator)</option>
              <option value="layering_chain">Layering Chain (Multi-hop)</option>
              <option value="pass_through_hub">Rapid Pass-Through</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase text-muted block mb-1">
              Detection Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-lg border border-gold/25 bg-[#07110D] px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none"
            >
              <option value="easy">Easy (Rapid Burst)</option>
              <option value="medium">Medium (Realistic Spacing)</option>
              <option value="hard">Hard (Delayed Smurfing)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-danger/50 bg-danger/20 py-1.5 text-xs font-bold text-danger hover:bg-danger/30 transition-colors cursor-pointer"
          >
            {loading ? 'Injecting...' : 'Inject Live Syndicate'}
          </button>
        </>
      )}
    </form>
  );
}

/** Production simulation controls wired to backend streaming endpoints (Module 12d) */
export function SimulationToolbar() {
  const { status, speed, elapsedSeconds, play, pause, reset, setSpeed, injectRing } =
    useSimulation();
  const isRunning = status === 'running';
  const isPristine = status === 'stopped' && elapsedSeconds === 0;
  const display = STATUS_DISPLAY[status];

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

      {/* Live Ring Injector Modal (Module 12d) */}
      <Popover
        align="end"
        panelLabel="Live Ring Injector"
        panelClassName="w-64 p-3 bg-[#0B1812] border border-gold/30 shadow-2xl rounded-xl backdrop-blur-md"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2.5 text-xs font-semibold text-danger hover:bg-danger/20 transition-colors cursor-pointer"
            title="Inject simulated mule ring for live demonstration"
          >
            <Zap className="size-3.5 fill-current" />
            <span className="hidden sm:inline">Inject Ring</span>
          </button>
        )}
      >
        {({ close }) => <InjectRingForm onClose={close} onInject={injectRing} />}
      </Popover>
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
