import { TYPOLOGY_META, type TypologyMeta } from '../../lib/typology';
import type { RingTypology } from '../../types/ring';

interface TypologyBadgeProps {
  typology: RingTypology | string;
}

export function TypologyBadge({ typology }: TypologyBadgeProps) {
  // 1. Direct key match (e.g. 'burst_fanin')
  let meta: TypologyMeta | undefined = TYPOLOGY_META[typology as RingTypology];

  // 2. Normalized key match (e.g. 'Burst Fan-in' or 'burst-fan-in' -> 'burst_fanin')
  if (!meta && typeof typology === 'string') {
    const normalizedKey = typology
      .toLowerCase()
      .trim()
      .replace(/[-\s]+/g, '_') as RingTypology;
    meta = TYPOLOGY_META[normalizedKey];
  }

  // 3. Label match (e.g. 'Burst Fan-in' matching label: 'Burst Fan-in')
  if (!meta && typeof typology === 'string') {
    meta = Object.values(TYPOLOGY_META).find(
      (m) => m.label.toLowerCase() === typology.toLowerCase().trim(),
    );
  }

  // 4. Safe fallback for arbitrary or unmapped typologies
  const resolvedLabel = meta?.label ?? (typeof typology === 'string' ? typology : 'Unknown');
  const resolvedColor = meta?.color ?? '#8B9B8F';

  return (
    <span
      className="inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium text-ink/90"
      style={{ borderColor: `${resolvedColor}55`, backgroundColor: `${resolvedColor}14` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: resolvedColor }} aria-hidden />
      {resolvedLabel}
    </span>
  );
}
