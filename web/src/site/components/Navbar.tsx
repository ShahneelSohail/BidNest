'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import type { PageMeta } from '../lib/api';
import { cx, LinkButton } from './ui';
import { useAuth } from './Providers';

const unreadCount = async () => {
  const { meta } = await api.page<unknown>('/me/notifications?pageSize=1');
  return (meta as PageMeta & { unread: number }).unread;
};

export const Navbar = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { data: unread = 0 } = useQuery({ queryKey: ['unread'], queryFn: unreadCount, enabled: Boolean(user), refetchInterval: 60_000 });

  const links = [
    { href: '/auctions', label: 'Auctions' },
    ...(user ? [{ href: '/dashboard', label: 'Dashboard' }, { href: '/sell', label: 'Sell' }] : []),
    ...(user?.role === 'ADMIN' ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const signOut = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:px-8">
        <Link href="/" className="text-xl font-bold tracking-tight">
          BIDNEST
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map(link => (
            <Link key={link.href} href={link.href} className={cx('rounded-lg px-3 py-2 transition hover:text-white', pathname.startsWith(link.href) ? 'text-white' : 'text-muted')}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/dashboard/notifications" className="relative text-muted hover:text-white" aria-label="Notifications">
                Alerts
                {unread > 0 && <span className="ml-1 rounded-full bg-yellow px-1.5 py-0.5 text-xs font-semibold text-black">{unread}</span>}
              </Link>
              <button onClick={signOut} className="text-muted hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-white">
                Log in
              </Link>
              <LinkButton href="/register">Sign up</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
