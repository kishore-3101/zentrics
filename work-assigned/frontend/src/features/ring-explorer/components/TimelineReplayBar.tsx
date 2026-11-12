import { Pause, Play, RotateCcw } from 'lucide-react';
import { formatInrCompact } from '../../../lib/formatters';
import type { TimelineRunningTotals } from '../../../types/ring-graph';

interface TimelineReplayBarProps {
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  progress: number;
  formattedTime: string;
  runningTotals: TimelineRunningTotals;
  totalTransactions: number;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onScrub: (progress: number) => void;
  onSpeedChange: (speed: 0.5 | 1 | 2 | 4) => void;
}

const SPEED_OPTIONS: (0.5 | 1 | 2 | 4)[] = [0.5, 1, 2, 4];

export function TimelineReplayBar({
  isPlaying,
  speed,
  progress,
  formattedTime,
  runningTotals,
  totalTransactions,
  onPlay,
  onPause,
  onRestart,
  onScrub,
  onSpeedChange,
}: TimelineReplayBarProps) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-card/80 p-3 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Playback controls & Clock */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
              className="grid size-9 place-items-center rounded-xl border border-gold/40 bg-linear-to-r from-emerald/20 to-gold/20 text-gold-light hover:border-gold/70 hover:shadow-glow-gold transition-all"
            >
              {isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onRestart}
              aria-label="Restart replay"
              className="grid size-9 place-items-center rounded-xl border border-gold/20 bg-canvas/60 text-muted hover:border-gold/40 hover:text-ink transition-colors"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center rounded-lg border border-gold/20 bg-canvas/70 p-0.5 text-xs">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onSpeedChange(opt)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                  speed === opt
                    ? 'bg-gold/25 text-gold-light shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {opt}x
              </button>
            ))}
          </div>

          {/* Virtual Timestamp */}
          <div className="flex flex-col pl-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
              Virtual Replay
            </span>
            <span className="font-mono text-xs font-bold text-gold-light tabular-nums">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Center: Timeline Scrubber */}
        <div className="flex-1 max-w-xl flex flex-col justify-center gap-1 px-2">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Inflow Genesis</span>
            <span className="font-mono text-ink">
              {runningTotals.completed_txns} / {totalTransactions} Transactions
            </span>
            <span>Terminal Cash-Out</span>
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={progress}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-canvas accent-gold"
          />
        </div>

        {/* Right: Dynamic Running Totals */}
        <div className="flex items-center justify-between gap-3 border-t border-gold/10 pt-2 lg:border-t-0 lg:pt-0">
          {/* Running Inflow */}
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
              Total Inflow
            </span>
            <span className="font-mono text-xs font-semibold text-emerald tabular-nums">
              {formatInrCompact(runningTotals.inflow)}
            </span>
          </div>

          {/* Running Cashed Out */}
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
              Cashed Out
            </span>
            <span className="font-mono text-xs font-semibold text-danger tabular-nums">
              {formatInrCompact(runningTotals.cashed_out)}
            </span>
          </div>

          {/* Running At Risk */}
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
              Amount At Risk
            </span>
            <span className="font-mono text-xs font-bold text-gold-light tabular-nums">
              {formatInrCompact(runningTotals.at_risk)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
