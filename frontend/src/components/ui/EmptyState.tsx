import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full border border-gold/20 bg-canvas/50 text-muted">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}
