import type { RingStatus } from '../../types/ring';
import { StatusBadge, type StatusTone } from './StatusBadge';

const STATUS_DISPLAY: Record<RingStatus, { label: string; tone: StatusTone; pulse?: boolean }> = {
  new: { label: 'New', tone: 'gold', pulse: true },
  under_review: { label: 'Under review', tone: 'warning' },
  frozen: { label: 'Frozen', tone: 'emerald' },
  escalated: { label: 'Escalated', tone: 'danger' },
  false_positive: { label: 'False positive', tone: 'neutral' },
};

export function RingStatusPill({ status }: { status: RingStatus }) {
  const display = STATUS_DISPLAY[status];
  return (
    <StatusBadge tone={display.tone} size="sm" dot pulse={display.pulse}>
      {display.label}
    </StatusBadge>
  );
}
