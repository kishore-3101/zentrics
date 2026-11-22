import { User } from 'lucide-react';
import { Popover } from '../ui/Popover';

export function ProfileMenu() {
  return (
    <Popover
      panelLabel="Profile"
      panelClassName="w-64"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Profile"
          title="Profile"
          className="grid size-9 place-items-center rounded-full border border-gold/30 bg-linear-to-br from-emerald/25 to-gold/20 text-gold-light transition duration-200 hover:border-gold/60 hover:shadow-glow-gold"
        >
          <User className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </button>
      )}
    >
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-ink">Analyst</p>
        <p className="text-xs text-muted">Profile placeholder</p>
      </div>
      <p className="border-t border-gold/10 px-4 py-3 text-xs leading-relaxed text-muted">
        Account details will appear here once a user identity is available.
      </p>
    </Popover>
  );
}
