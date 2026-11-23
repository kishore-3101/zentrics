import { useApiHealth, type ApiHealthStatus } from '../../hooks/useApiHealth';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

const CONFIG: Record<ApiHealthStatus, { label: string; tone: StatusTone; pulse: boolean; hint: string }> = {
  live: { label: 'API connected', tone: 'emerald', pulse: true, hint: 'Connected to the backend API and database' },
  offline: { label: 'API offline', tone: 'danger', pulse: false, hint: 'The backend API is unreachable' },
  unknown: { label: 'API connecting', tone: 'neutral', pulse: false, hint: 'Checking database connectivity...' },
};

export function ApiHealthIndicator() {
  const { status } = useApiHealth();
  const { label, tone, pulse, hint } = CONFIG[status];

  return (
    <StatusBadge tone={tone} size="sm" dot pulse={pulse} title={hint}>
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </StatusBadge>
  );
}
