import { UserX } from 'lucide-react';

interface AssigneeAvatarProps {
  assignee: string | null;
  size?: 'sm' | 'md';
}

function getInitials(name: string): string {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AssigneeAvatar({ assignee, size = 'sm' }: AssigneeAvatarProps) {
  if (!assignee) {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-xs text-muted/70"
        title="Unassigned alert"
      >
        <span className="grid size-6 place-items-center rounded-full border border-dashed border-gold/30 bg-canvas/60 text-muted">
          <UserX className="size-3" aria-hidden />
        </span>
        <span className="italic">Unassigned</span>
      </div>
    );
  }

  const initials = getInitials(assignee);
  const sizeClass = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs';

  return (
    <div className="inline-flex items-center gap-2" title={assignee}>
      <span
        className={`grid ${sizeClass} shrink-0 place-items-center rounded-full border border-gold/35 bg-gold/15 font-mono font-semibold text-gold-light shadow-sm`}
        aria-hidden
      >
        {initials}
      </span>
      <span className="max-w-[130px] truncate text-xs text-ink/90 font-medium">
        {assignee.split(' ')[0]} {assignee.split(' ')[1] || ''}
      </span>
    </div>
  );
}
