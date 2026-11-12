import { Bell, BellOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Popover } from '../ui/Popover';

interface NotificationMenuProps {
  /** Wired up once the live alert feed (Module 12d) exists. */
  unreadCount?: number;
}

export function NotificationMenu({ unreadCount = 0 }: NotificationMenuProps) {
  return (
    <Popover
      panelLabel="Notifications"
      panelClassName="w-80"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          title="Notifications"
          className={cn(
            'relative inline-flex size-9 items-center justify-center rounded-xl border border-gold/20 text-muted transition-colors duration-200 hover:border-gold/45 hover:bg-gold/5 hover:text-gold-light',
            open && 'border-gold/45 text-gold-light',
          )}
        >
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald shadow-glow-emerald ring-2 ring-canvas" />
          )}
        </button>
      )}
    >
      <div className="border-b border-gold/10 px-4 py-3">
        <p className="text-sm font-semibold text-ink">Notifications</p>
      </div>
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="grid size-10 place-items-center rounded-full border border-gold/20 bg-card text-muted">
          <BellOff className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="text-sm font-medium text-ink">No notifications yet</p>
        <p className="text-xs leading-relaxed text-muted">
          New ring detections will appear here once the live alert feed is connected.
        </p>
      </div>
    </Popover>
  );
}
