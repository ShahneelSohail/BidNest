'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from './ui';

const tabs = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/security', label: 'Password & security' },
  { href: '/settings/notifications', label: 'Notifications' },
];

const unavailable = ['Saved addresses', 'Payment methods', 'Close account'];

export const SettingsShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 pb-24 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-24">
      <nav aria-label="Settings" className="flex flex-col gap-2 self-start lg:sticky lg:top-24 lg:gap-0.5">
        <p className="display mb-2 text-4xl leading-none lg:mb-5 lg:text-[44px]">Settings</p>
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5">
          {tabs.map(tab => {
            const current = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href} aria-current={current ? 'page' : undefined} className={cx('flex h-10 flex-none items-center rounded-full px-4 text-sm whitespace-nowrap transition lg:h-12 lg:rounded-none lg:border-l lg:px-4 lg:text-[15px]', current ? 'bg-text font-semibold text-ink lg:border-gold-300 lg:bg-transparent lg:text-text' : 'text-text-2 hover:text-text lg:border-line')}>
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="my-5 hidden h-px bg-line lg:block" />
        <ul className="hidden lg:block">
          {unavailable.map(label => (
            <li key={label} className="flex h-11 items-center justify-between pl-4 text-sm text-muted/70">
              {label}
              <span className="text-[10px] tracking-[0.14em] uppercase">Soon</span>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-3xl min-w-0">{children}</div>
    </div>
  );
};
