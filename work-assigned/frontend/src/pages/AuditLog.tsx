import { ScrollText } from 'lucide-react';
import { PlaceholderPage } from '../components/ui/PlaceholderPage';

export default function AuditLog() {
  return (
    <PlaceholderPage
      icon={ScrollText}
      title="Compliance Audit Log"
      moduleLabel="Module 16 · /audit"
      description="Immutable record of analyst actions taken on cases."
      planned={[
        'Timestamped case-action trail',
        'Actor, action type and status transition columns',
        'Analyst notes per action',
      ]}
    />
  );
}
