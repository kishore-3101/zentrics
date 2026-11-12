import { TYPOLOGY_META } from '../../lib/typology';
import type { RingTypology } from '../../types/ring';

export function TypologyBadge({ typology }: { typology: RingTypology }) {
  const { label, color } = TYPOLOGY_META[typology];

  return (
    <span
      className="inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium text-ink/90"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}
