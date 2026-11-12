import { Skeleton } from '../../../components/ui/Skeleton';

/** Loading layout that mirrors the dashboard grid to avoid layout shift. */
export function OverviewSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1400px] space-y-5">
      <Skeleton className="h-5 w-80 max-w-full" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-44 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-[26rem] rounded-2xl xl:col-span-2" />
        <Skeleton className="h-[26rem] rounded-2xl" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <span className="sr-only">Loading overview…</span>
    </div>
  );
}
