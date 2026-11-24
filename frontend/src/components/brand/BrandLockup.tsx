import { cn } from '../../lib/cn';

/** Official Zentrics Emblem: Gold Hexagon with Emerald Mule Head */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/favicon.png"
      alt="Zentrics Emblem"
      width={size}
      height={size}
      className={cn('object-contain drop-shadow-[0_0_10px_rgba(0,200,120,0.28)]', className)}
    />
  );
}

interface BrandLockupProps {
  /** Mark only (used by the collapsed sidebar). */
  compact?: boolean;
  className?: string;
}

export function BrandLockup({ compact = false, className }: BrandLockupProps) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-[0.16em] text-ink">
            ZENTRICS
          </span>
          <span className="mt-1.5 font-mono text-[9px] font-medium tracking-[0.24em] text-muted">
            FINANCIAL INTELLIGENCE
          </span>
        </span>
      )}
    </span>
  );
}
