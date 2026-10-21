'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { countsOf, useSellerAnalytics } from '../lib/seller';
import { useAuth } from './Providers';
import { Icon, type IconName } from './sell-icons';
import { cx, Eyebrow } from './ui';

interface NavItem {
  href: string;
  label: string;
  tabLabel: string;
  icon: IconName;
  isActive: (pathname: string) => boolean;
}

const sellNav: NavItem[] = [
  { href: '/sell', label: 'Listings', tabLabel: 'Listings', icon: 'list', isActive: pathname => /^\/sell(\/\d+.*)?$/.test(pathname) },
  { href: '/sell/new', label: 'Create listing', tabLabel: 'Sell', icon: 'plus', isActive: pathname => pathname === '/sell/new' },
  { href: '/sell?status=rejected', label: 'Needs changes', tabLabel: 'Feedback', icon: 'alert', isActive: () => false },
];

const accountNav: NavItem[] = [
  { href: '/dashboard', label: 'Buying', tabLabel: 'Buying', icon: 'bag', isActive: () => false },
  { href: '/settings', label: 'Settings', tabLabel: 'Settings', icon: 'settings', isActive: () => false },
];

const SectionLabel = ({ children }: { children: ReactNode }) => <Eyebrow className="mx-3 mt-6 mb-2.5 text-muted! first:mt-0">{children}</Eyebrow>;

export const SellShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const analytics = useSellerAnalytics('30');
  const counts = analytics.data && countsOf(analytics.data);
  const sidebarCounts: Record<string, number | undefined> = { '/sell': counts?.all, '/sell?status=rejected': counts?.rejected || undefined };
  const tabBar = [...sellNav, accountNav[0]!];

  return (
    <div className="pb-24 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-14 lg:pb-0">
      <aside className="sticky top-24 hidden flex-col gap-0.5 self-start border border-line bg-surface px-4 py-8 lg:flex">
        <div className="mb-7 flex flex-col gap-1.5 px-3">
          <p className="display text-[22px] leading-[1.15]">{user?.fullName}</p>
          <p className="text-xs text-muted">@{user?.username} · Seller</p>
        </div>
        <SectionLabel>Selling</SectionLabel>
        {sellNav.map(item => {
          const active = item.isActive(pathname);
          const count = sidebarCounts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx('flex h-11 items-center gap-3 px-3 text-sm transition hover:bg-surface-2 hover:text-text', active ? 'bg-surface-2 text-text shadow-[inset_2px_0_0_var(--color-gold-300)]' : 'text-text-2')}
            >
              <Icon name={item.icon} size={17} />
              <span className="flex-1">{item.label}</span>
              {count !== undefined && <span className={cx('tnum text-[11px]', item.icon === 'alert' ? 'text-danger' : active ? 'text-gold-300' : 'text-muted')}>{count}</span>}
            </Link>
          );
        })}
        <SectionLabel>Account</SectionLabel>
        {accountNav.map(item => (
          <Link key={item.href} href={item.href} className="flex h-11 items-center gap-3 px-3 text-sm text-text-2 transition hover:bg-surface-2 hover:text-text">
            <Icon name={item.icon} size={17} />
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="min-w-0">{children}</div>
      <nav aria-label="Seller" className="fixed inset-x-0 bottom-0 z-30 grid h-[84px] grid-cols-4 border-t border-line bg-surface/90 px-2 pt-2 pb-7 backdrop-blur-xl lg:hidden">
        {tabBar.map(item => {
          const active = item.isActive(pathname);
          const badge = item.icon === 'alert' ? counts?.rejected : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cx('relative flex min-h-12 flex-col items-center justify-center gap-1', active ? 'text-gold-300' : 'text-muted')}>
              <span aria-hidden className={cx('absolute -top-2 h-0.5 w-5', active ? 'bg-gold-300' : 'bg-transparent')} />
              <Icon name={item.icon} size={22} />
              <span className="text-[10px] font-medium">{item.tabLabel}</span>
              {!!badge && <span className="absolute top-0.5 left-1/2 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9.5px] font-bold text-ink">{badge}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
