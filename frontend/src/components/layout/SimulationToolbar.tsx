import { Check, ChevronDown, Pause, Play, RotateCcw } from 'lucide-react';
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

/** Compact simulation controls. Visual + local state only for now. */
export function SimulationToolbar() {
  const { status, speed, elapsedSeconds, play, pause, reset, setSpeed } = useSimulation();
  const isRunning = status === 'running';
  const isPristine = status === 'stopped' && elapsedSeconds === 0;
  const display = STATUS_DISPLAY[status];

  return (
    <div
      role="group"
      aria-label="Simulation controls"
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-gold/20 bg-card/60 p-1.5 sm:w-auto sm:justify-start"
    >
      <StatusBadge tone={display.tone} size="sm" dot pulse={isRunning} className="hidden sm:inline-flex">
        {display.label}
      </StatusBadge>
      <Divider />

      <div className="flex items-center gap-1">
        <IconButton label="Play simulation" variant="emerald" size="sm" onClick={play} disabled={isRunning}>
          <Play className="size-3.5 fill-current" aria-hidden />
        </IconButton>
        <IconButton label="Pause simulation" variant="gold" size="sm" onClick={pause} disabled={!isRunning}>
          <Pause className="size-3.5 fill-current" aria-hidden />
        </IconButton>
        <IconButton label="Reset simulation" variant="outline" size="sm" onClick={reset} disabled={isPristine}>
          <RotateCcw className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <Divider />

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
            <ChevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
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
