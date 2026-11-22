/** Shown while a lazily loaded page chunk is downloading. */
export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-card" />
      <div className="h-40 rounded-2xl bg-card/70" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
