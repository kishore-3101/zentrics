import { Skeleton } from '../../../components/ui/Skeleton';

export function AlertTableSkeleton() {
  return (
    <div className="rounded-2xl border border-gold/15 bg-card/40 p-4 space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-gold/10">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-gold/5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
