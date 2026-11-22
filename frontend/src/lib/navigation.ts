import {
  BrainCircuit,
  LayoutDashboard,
  Network,
  ScrollText,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { matchPath } from 'react-router-dom';

/** Temporary target until the Alert Queue links rows to real ring ids. */
export const DEMO_RING_PATH = '/rings/demo-ring';

export interface NavItem {
  id: 'overview' | 'alerts' | 'rings' | 'metrics' | 'audit';
  label: string;
  /** Where the sidebar link navigates. */
  to: string;
  /** Pattern used to decide whether the item is active. */
  matchPattern: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: 'Executive Overview', to: '/overview', matchPattern: '/overview', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alert Queue', to: '/alerts', matchPattern: '/alerts', icon: ShieldAlert },
  { id: 'rings', label: 'Ring Explorer', to: DEMO_RING_PATH, matchPattern: '/rings/*', icon: Network },
  { id: 'metrics', label: 'Models & Evaluation', to: '/metrics', matchPattern: '/metrics', icon: BrainCircuit },
  { id: 'audit', label: 'Compliance Audit Log', to: '/audit', matchPattern: '/audit', icon: ScrollText },
];

export interface Crumb {
  label: string;
  to?: string;
}

export interface RouteMeta {
  title: string;
  crumbs: Crumb[];
}

const ROOT_CRUMB: Crumb = { label: 'MuleNet', to: '/overview' };

export function getRouteMeta(pathname: string): RouteMeta {
  const item = NAV_ITEMS.find((candidate) => matchPath(candidate.matchPattern, pathname));

  if (!item) {
    return { title: 'Page not found', crumbs: [ROOT_CRUMB, { label: 'Not found' }] };
  }

  if (item.id === 'rings') {
    const ringId = matchPath('/rings/:id', pathname)?.params.id;
    if (ringId) {
      return { title: item.label, crumbs: [ROOT_CRUMB, { label: item.label }, { label: ringId }] };
    }
  }

  return { title: item.label, crumbs: [ROOT_CRUMB, { label: item.label }] };
}
