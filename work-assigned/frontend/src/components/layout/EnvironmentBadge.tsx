import { ENV_LABEL } from '../../config/env';
import { StatusBadge } from '../ui/StatusBadge';

export function EnvironmentBadge() {
  return (
    <StatusBadge
      tone={ENV_LABEL === 'DEMO' ? 'gold' : 'emerald'}
      size="sm"
      dot
      title={`Environment: ${ENV_LABEL}`}
    >
      {ENV_LABEL}
    </StatusBadge>
  );
}
