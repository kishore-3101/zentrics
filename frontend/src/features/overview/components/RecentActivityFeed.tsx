import { Activity, Flag, MessageSquare, Search, ShieldAlert, Snowflake, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardCard } from '../../../components/ui/DashboardCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { cn } from '../../../lib/cn';
import { formatRelativeTime } from '../../../lib/formatters';
import type { ActivityEvent, ActivityKind } from '../types';

const KIND_DISPLAY: Record<ActivityKind, { title: string; icon: LucideIcon; chip: string }> = {
  detected: { title: 'New ring detected', icon: ShieldAlert, chip: 'border-gold/35 bg-gold/10 text-gold-light' },
  under_review: { title: 'Investigation opened', icon: Search, chip: 'border-warning/35 bg-warning/10 text-warning' },
  frozen: { title: 'Ring accounts frozen', icon: Snowflake, chip: 'border-emerald/30 bg-emerald/10 text-emerald' },
  escalated: { title: 'Escalated to Senior AML', icon: Flag, chip: 'border-danger/35 bg-danger/10 text-danger' },
  note: { title: 'Case note added', icon: MessageSquare, chip: 'border-white/15 bg-white/5 text-muted' },
};

interface RecentActivityFeedProps {
  events: readonly ActivityEvent[];
  delay?: number;
  className?: string;
}

export function RecentActivityFeed({ events, delay = 0, className }: RecentActivityFeedProps) {
  return (
    <DashboardCard
      title="Recent Activity"
      description="Latest detections and investigation events"
      delay={delay}
      className={className}
      bodyClassName="max-h-[26rem] overflow-y-auto pb-3"
      action={
        <StatusBadge tone="gold" size="sm" title="Illustrative events, not live data">
          Mock data
        </StatusBadge>
      }
    >
      {events.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Detections and analyst actions will appear here." />
      ) : (
        <ol className="relative space-y-4">
          <span aria-hidden className="absolute bottom-2 left-[17px] top-2 w-px bg-gold/12" />
          {events.map((event) => {
            const display = KIND_DISPLAY[event.kind];
            const Icon = display.icon;
            return (
              <li key={event.id} className="relative flex gap-3">
                <span className={cn('relative z-10 grid size-9 shrink-0 place-items-center rounded-full border', display.chip)}>
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">{display.title}</p>
                    <time dateTime={event.occurredAt} className="shrink-0 text-[11px] text-muted">
                      {formatRelativeTime(event.occurredAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    <Link
                      to={`/rings/${encodeURIComponent(event.ringId)}`}
                      className="font-mono font-semibold text-gold-light transition-colors hover:text-gold"
                    >
                      {event.ringId}
                    </Link>
                    {' · '}
                    {event.detail}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted/70">{event.actor}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardCard>
  );
}
