import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getRouteMeta } from '../../lib/navigation';
import { IconButton } from '../ui/IconButton';
import { ApiHealthIndicator } from './ApiHealthIndicator';
import { Breadcrumbs } from './Breadcrumbs';
import { EnvironmentBadge } from './EnvironmentBadge';
import { NotificationMenu } from './NotificationMenu';
import { ProfileMenu } from './ProfileMenu';

interface HeaderProps {
  onOpenNavigation: () => void;
}

export function Header({ onOpenNavigation }: HeaderProps) {
  const { pathname } = useLocation();
  const { title, crumbs } = getRouteMeta(pathname);

  return (
    <header
      data-anim="header"
      className="sticky top-0 z-30 border-b border-gold/15 bg-canvas/85 backdrop-blur-md transition-colors"
    >
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton
            label="Open navigation"
            variant="outline"
            className="lg:hidden shrink-0"
            onClick={onOpenNavigation}
          >
            <Menu className="size-[18px]" aria-hidden />
          </IconButton>

          <div className="min-w-0">
            <Breadcrumbs crumbs={crumbs} />
            <h1 className="mt-0.5 truncate font-display text-lg sm:text-xl font-bold tracking-tight text-ink">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <EnvironmentBadge />
          <ApiHealthIndicator />
          <span className="h-5 w-px bg-gold/15 mx-1 hidden sm:block" aria-hidden />
          <NotificationMenu />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
