import { Network } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';

export function RingExplorerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-gold/15 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Summary bar skeleton */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Canvas Radar Scan placeholder */}
      <div className="relative flex h-[620px] w-full flex-col items-center justify-center rounded-2xl border border-gold/15 bg-[#07110D] overflow-hidden">
        <div className="absolute inset-0 bg-radial from-emerald/10 via-transparent to-transparent animate-pulse" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="grid size-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-light shadow-glow-gold animate-bounce">
            <Network className="size-7" />
          </div>
          <p className="font-mono text-sm font-semibold text-gold-light">
            Constructing 3D Transaction Topology...
          </p>
          <p className="text-xs text-muted">
            Mapping account nodes, directional vectors, and timeline sequences
          </p>
        </div>
      </div>
    </div>
  );
}
