import { useId } from 'react';
import { cn } from '../../lib/cn';

/** Hexagonal mesh mark: gold frame, emerald nodes, gold core. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gradientId = `tm-gold-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={cn('drop-shadow-[0_0_10px_rgba(0,200,120,0.28)]', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5C778" />
          <stop offset="1" stopColor="#C9A85B" />
        </linearGradient>
      </defs>
      <path
        d="M20 2.5 35.15 11.25V28.75L20 37.5 4.85 28.75V11.25Z"
        fill="rgba(0,200,120,0.06)"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M20 11 29 26H11Z" stroke="#00C878" strokeOpacity="0.55" strokeWidth="1" strokeLinejoin="round" />
      <path d="M20 11v8M11 26l9-7M29 26l-9-7" stroke="#00C878" strokeOpacity="0.55" strokeWidth="1" />
      <circle cx="20" cy="19" r="2.6" fill="#E5C778" />
      <circle cx="20" cy="11" r="2" fill="#00C878" />
      <circle cx="11" cy="26" r="2" fill="#00C878" />
      <circle cx="29" cy="26" r="2" fill="#00C878" />
    </svg>
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
            MULE <span className="text-gold-gradient">NET</span>
          </span>
          <span className="mt-1.5 font-mono text-[9px] font-medium tracking-[0.24em] text-muted">
            FINANCIAL INTELLIGENCE
          </span>
        </span>
      )}
    </span>
  );
}
