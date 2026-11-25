import { AnimatePresence, motion } from 'motion/react';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { EASE_OUT } from '../../lib/motion';
import { NAV_ITEMS, type NavItem } from '../../lib/navigation';
import { BrandLockup } from '../brand/BrandLockup';
import { IconButton } from '../ui/IconButton';

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 84;

interface NavLinkItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavLinkItem({ item, active, collapsed, onNavigate }: NavLinkItemProps) {
  const Icon = item.icon;

  return (
    <li data-anim="nav-item">
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex h-11 items-center gap-3 overflow-hidden rounded-xl px-3.5 text-sm font-medium transition-colors duration-200',
          active ? 'text-gold-light' : 'text-muted hover:text-ink',
          collapsed && 'justify-center px-0 gap-0',
        )}
      >
        {active ? (
          <motion.span
            layoutId="sidebar-active-pill"
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="absolute inset-0 rounded-xl border border-gold/25 bg-linear-to-r from-emerald/12 via-gold/8 to-transparent"
          >
            {/* Active accent border: covers full height on the left and curves around the top & bottom corners */}
            <span
              className="pointer-events-none absolute inset-0 rounded-xl border-2 border-transparent border-l-gold-light border-t-gold-light border-b-gold-light shadow-[0_0_12px_rgba(201,168,91,0.45)]"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, black 0%, black 24px, transparent 64px)',
                maskImage: 'linear-gradient(to right, black 0%, black 24px, transparent 64px)',
              }}
              aria-hidden
            />
          </motion.span>
        ) : (
          <span className="absolute inset-0 rounded-xl bg-white/0 transition-colors duration-200 group-hover:bg-white/4" />
        )}

        <Icon
          className={cn(
            'relative size-[18px] shrink-0 transition-colors duration-200',
            active ? 'text-emerald' : 'group-hover:text-emerald',
          )}
          strokeWidth={1.75}
          aria-hidden
        />
        <span
          aria-hidden={collapsed}
          className={cn('relative whitespace-nowrap transition-opacity duration-150', collapsed ? 'hidden' : 'inline-block')}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}

interface SidebarBodyProps {
  collapsed: boolean;
  onNavigate?: () => void;
  /** Mobile drawer: renders a close button. */
  onClose?: () => void;
  /** Desktop: renders the collapse toggle. */
  onToggleCollapsed?: () => void;
}

function SidebarBody({ collapsed, onNavigate, onClose, onToggleCollapsed }: SidebarBodyProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-gold/10 px-5 overflow-hidden',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <Link to="/overview" onClick={onNavigate} aria-label="Zentrics home" className="rounded-lg">
          <BrandLockup compact={collapsed} />
        </Link>
        {onClose && (
          <IconButton label="Close navigation" variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        )}
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-5">
        <p
          aria-hidden
          className={cn(
            'mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted/70 transition-opacity duration-150',
            collapsed ? 'hidden' : 'block',
          )}
        >
          Command center
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLinkItem
              key={item.id}
              item={item}
              active={Boolean(matchPath(item.matchPattern, pathname))}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      {onToggleCollapsed && (
        <div className="shrink-0 border-t border-gold/10 p-3 overflow-hidden">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-10 w-full items-center gap-3 overflow-hidden rounded-xl px-3.5 text-sm text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
          >
            {collapsed ? (
              <ChevronsRight className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            ) : (
              <ChevronsLeft className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            )}
            <span
              aria-hidden
              className={cn('whitespace-nowrap transition-opacity duration-150', collapsed ? 'hidden' : 'inline-block')}
            >
              
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Desktop sidebar (rendered from the `lg` breakpoint up). Width animates with Motion. */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <motion.aside
      data-anim="sidebar"
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="relative z-20 h-full shrink-0 border-r border-gold/12 bg-linear-to-b from-sidebar to-[#08130e] overflow-hidden"
    >
      <SidebarBody collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
    </motion.aside>
  );
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Slide-in navigation drawer for viewports below `lg`. */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
          <motion.aside
            key="drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="fixed inset-y-0 left-0 z-50 w-[min(86vw,19rem)] border-r border-gold/15 bg-sidebar shadow-panel outline-hidden lg:hidden"
          >
            <SidebarBody collapsed={false} onNavigate={onClose} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
