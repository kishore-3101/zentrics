import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from './StatusBadge';

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  /** e.g. "Module 13 · Executive Overview" */
  moduleLabel: string;
  description: string;
  /** Deliverables from the module docs that will land on this page. */
  planned: readonly string[];
  children?: ReactNode;
}

/** Consistent stand-in for pages whose functionality arrives in later tasks. */
export function PlaceholderPage({
  icon: Icon,
  title,
  moduleLabel,
  description,
  planned,
  children,
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="glass relative overflow-hidden rounded-2xl p-6 shadow-panel sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-80 bg-[radial-gradient(circle,rgb(0_200_120/0.14),transparent_65%)]"
        />

        <div className="relative flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-linear-to-br from-emerald/15 to-gold/10 text-gold-light">
            <Icon className="size-6" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="gold" size="sm">
                Placeholder
              </StatusBadge>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{moduleLabel}</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
            {children}
          </div>
        </div>

        <div className="relative mt-8 border-t border-gold/10 pt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Planned for this view</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {planned.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-canvas/40 px-4 py-3 text-sm text-ink/90"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald shadow-glow-emerald" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
