import type { IconName } from '@/ui/icon-registry';

/** The dashboard's views. Crew never see this navigation. */
export type NavView = 'ADMIN' | 'SUPERVISOR';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Other paths that should light this item up. */
  match?: string[];
}

export interface NavGroups {
  main: NavItem[];
  more: NavItem[];
}

/** What the sidebar and the top bar both show, in order. */
export function navFor(view: NavView, pending: number): NavGroups {
  const main: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: 'squares-four' },
    { href: '/dashboard/yard-plans', label: 'Yard planning', icon: 'list-checks' },
    // Admin only for now: the page behind it is locked for supervisors.
    ...(view === 'ADMIN' ? [{ href: '/dashboard/admin/sections', label: 'Yard management', icon: 'buildings' } satisfies NavItem] : []),
    { href: '/dashboard/shifts', label: 'Shift planning', icon: 'clock' },
    { href: '/dashboard/reports', label: 'Reports', icon: 'file-pdf' },
  ];
  const more: NavItem[] = [
    { href: '/dashboard/review', label: 'Review queue', icon: 'warning-circle', badge: pending },
    { href: '/dashboard/containers', label: 'Containers', icon: 'shipping-container' },
    { href: '/dashboard/people', label: 'People', icon: 'users' },
    {
      href: '/dashboard/settings',
      label: 'Settings',
      icon: 'gear-six',
      match: ['/dashboard/admin/mappings', '/dashboard/admin/integrations', '/dashboard/admin/activity'],
    },
  ];
  return { main, more };
}

const within = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function isActive(path: string, item: Pick<NavItem, 'href' | 'match'>): boolean {
  // Overview is the parent of every dashboard path, so only its exact path counts.
  if (item.href === '/dashboard') return path === '/dashboard' || path === '/dashboard/';
  return within(path, item.href) || (item.match ?? []).some((m) => within(path, m));
}
