import { memo, useEffect, useState } from 'react';

interface CinematicLoadingBarProps {
  progress: number; // 0 to 100
  onSkip?: () => void;
  statusText?: string;
}

const PHASES = [
  { min: 0, max: 22, text: 'INITIALIZING GRAPH TOPOLOGY ENGINE...' },
  { min: 22, max: 48, text: 'MAPPING MULTI-HOP SUSPICIOUS FLOWS...' },
  { min: 48, max: 74, text: 'ISOLATING MULE ACCUMULATION LAYERS...' },
  { min: 74, max: 94, text: 'CALIBRATING DETECTION & COMPLIANCE RULES...' },
  { min: 94, max: 100, text: 'COMMAND CENTER INITIALIZED' },
];

export const CinematicLoadingBar = memo(function CinematicLoadingBar({
  progress,
  onSkip,
}: CinematicLoadingBarProps) {
  const [clampedProgress, setClampedProgress] = useState(0);

  useEffect(() => {
    setClampedProgress(Math.min(100, Math.max(0, progress)));
  }, [progress]);

  const currentPhase =
    PHASES.find((p) => clampedProgress >= p.min && clampedProgress <= p.max)?.text ||
    'LOADING FINANCIAL INTELLIGENCE...';

  return (
    <div className="relative z-30 flex flex-col items-center justify-between w-full max-w-2xl px-6 select-none">
      {/* Sleek Glowing Loading Bar (Exact match with reference image) */}
      <div className="relative w-full">
        {/* Outer Glowing Border Capsule */}
        <div className="relative h-6 w-full overflow-hidden rounded-full border-2 border-emerald/50 bg-[#06140E] p-1 shadow-[0_0_20px_rgba(0,200,120,0.35)]">
          {/* Animated Candy-Stripe Emerald-to-Gold Fill */}
          <div
            className="relative h-full rounded-full transition-all duration-300 ease-out overflow-hidden"
            style={{
              width: `${clampedProgress}%`,
              background: 'linear-gradient(90deg, #00C878 0%, #34D399 45%, #C9A85B 80%, #E5C778 100%)',
              boxShadow: '0 0 16px rgba(201, 168, 91, 0.65)',
            }}
          >
            {/* Diagonal Candy-Stripe Overlay Animation */}
            <div
              className="absolute inset-0 w-full h-full opacity-40 animate-[candyStripe_1.5s_linear_infinite]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 6px, transparent 6px, transparent 14px)',
                backgroundSize: '28px 28px',
              }}
            />

            {/* Glowing Front Edge Highlight */}
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-white blur-xs opacity-80" />
          </div>
        </div>
      </div>

      {/* "L O A D I N G . . ." Typography (Matching reference) */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <p className="font-mono text-xs font-bold tracking-[0.4em] text-gold-light uppercase drop-shadow-[0_0_10px_rgba(201,168,91,0.5)]">
          L O A D I N G . . .
        </p>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted/70">
          <span className="text-emerald font-semibold">{currentPhase}</span>
          <span>&bull;</span>
          <span className="text-gold-light tabular-nums font-bold">{Math.round(clampedProgress)}%</span>
        </div>
      </div>

      {/* Skip Button */}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 text-[10px] font-mono text-muted/60 hover:text-gold-light transition-colors underline decoration-dotted"
        >
          [ Skip to Command Center &rarr; ]
        </button>
      )}
    </div>
  );
});

// Top Branding Banner component matching the reference image's framed pill
export const CinematicBrandHeader = memo(function CinematicBrandHeader() {
  return (
    <div className="relative z-30 flex flex-col items-center select-none pt-4 pb-2">
      <div className="relative rounded-2xl border-2 border-gold/40 bg-card/60 px-8 py-2.5 shadow-[0_0_35px_rgba(201,168,91,0.3)] backdrop-blur-md">
        {/* Corner Bracket Accents */}
        <span className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-gold-light" />
        <span className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-gold-light" />
        <span className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-gold-light" />
        <span className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-gold-light" />

        <h1 className="font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-[#E5C778] via-[#C9A85B] to-[#FFE6A3] drop-shadow-[0_0_18px_rgba(201,168,91,0.6)]">
          TRACE-MESH
        </h1>
      </div>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.3em] text-emerald/80">
        AI-Powered Mule Account Ring Intelligence
      </p>
    </div>
  );
});
