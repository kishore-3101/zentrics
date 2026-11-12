import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getRouteMeta } from '../../lib/navigation';
import { IconButton } from '../ui/IconButton';
import { ApiHealthIndicator } from './ApiHealthIndicator';
import { Breadcrumbs } from './Breadcrumbs';
import { EnvironmentBadge } from './EnvironmentBadge';
import { NotificationMenu } from './NotificationMenu';
import { ProfileMenu } from './ProfileMenu';
import { SimulationToolbar } from './SimulationToolbar';

interface HeaderProps {
  onOpenNavigation: () => void;
}

export function Header({ onOpenNavigation }: HeaderProps) {
  const { pathname } = useLocation();
  const { title, crumbs } = getRouteMeta(pathname);

  return (
    <header
      data-anim="header"
      className="sticky top-0 z-30 border-b border-gold/12 bg-canvas/80 backdrop-blur-md"
    >
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8 xl:flex-nowrap">
        <IconButton
          label="Open navigation"
          variant="outline"
          className="lg:hidden"
          onClick={onOpenNavigation}
        >
          <Menu className="size-[18px]" aria-hidden />
        </IconButton>

        <div className="min-w-0 flex-1">
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
        </div>

        <div className="order-last w-full xl:order-none xl:w-auto">
          <SimulationToolbar />
        </div>

        <div className="flex items-center gap-2">
          <EnvironmentBadge />
          <ApiHealthIndicator />
          <NotificationMenu />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
