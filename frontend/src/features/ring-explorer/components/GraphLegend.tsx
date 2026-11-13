export function GraphLegend() {
  const items = [
    { label: 'Victim', color: '#00C878', shape: 'Sphere' },
    { label: 'Collector', color: '#C9A85B', shape: 'Octahedron' },
    { label: 'Mule', color: '#F59E0B', shape: 'Orbital Ring' },
    { label: 'Cash-Out', color: '#EF4444', shape: 'Terminal Cube' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-card/75 px-3 py-1.5 shadow-md backdrop-blur-md text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mr-1">
        Legend:
      </span>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: it.color }}
            aria-hidden
          />
          <span className="text-[11px] font-medium text-ink/90">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
