'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { PageMeta } from '../lib/api';
import { useAuth } from './Providers';
import { Avatar, cx, LinkButton } from './ui';

const unreadCount = async () => {
  const { meta } = await api.page<unknown>('/me/notifications?pageSize=1');
  return (meta as PageMeta & { unread: number }).unread;
};

const UserMenu = ({ onSignOut }: { onSignOut: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) return null;
  const items = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/sell', label: 'My listings' },
    { href: '/settings', label: 'Settings' },
    ...(user.role === 'ADMIN' ? [{ href: '/admin', label: 'Admin console' }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2.5 rounded-full border border-line-strong py-1 pr-4 pl-1 text-[13px] transition hover:border-gold-300">
        <Avatar name={user.username} src={user.avatarUrl} className="size-8 bg-gold-300 text-[11px] font-bold text-ink" />
        {user.username}
      </button>
      {open && (
        <div role="menu" className="rise absolute right-0 mt-3 w-56 rounded-md border border-line-strong bg-surface-2 py-2 shadow-e3">
          {items.map(item => (
            <Link key={item.href} role="menuitem" href={item.href} onClick={() => setOpen(false)} className="block px-5 py-2.5 text-sm text-text-2 transition hover:bg-gold-300/5 hover:text-gold-300">
              {item.label}
            </Link>
          ))}
          <div className="my-2 h-px bg-line" />
          <button role="menuitem" onClick={onSignOut} className="block w-full px-5 py-2.5 text-left text-sm text-text-2 transition hover:text-danger">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export const Navbar = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: unread = 0 } = useQuery({ queryKey: ['unread'], queryFn: unreadCount, enabled: Boolean(user), refetchInterval: 60_000 });

  const links = [
    { href: '/auctions', label: 'Auctions' },
    ...(user ? [{ href: '/dashboard', label: 'Dashboard' }, { href: '/sell', label: 'Sell' }] : []),
  ];

  const signOut = async () => {
    await logout();
    router.push('/');
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/auctions?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-lg">
      <div className="mx-auto flex h-[72px] max-w-[1560px] items-center gap-8 px-6 md:px-12">
        <Link href="/" className="display gold-text text-[26px]">
          BidNest
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(link => (
            <Link key={link.href} href={link.href} className={cx('px-3 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase transition', pathname.startsWith(link.href) ? 'text-gold-300' : 'text-muted hover:text-text')}>
              {link.label}
            </Link>
          ))}
        </nav>
        <form onSubmit={submitSearch} role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search lots, makers, categories" aria-label="Search auctions" className="h-10 w-full border-0 border-b border-line-strong bg-transparent text-sm text-text placeholder:text-muted outline-none transition focus:border-gold-300" />
        </form>
        <div className="ml-auto flex items-center gap-4 md:ml-0">
          {user ? (
            <>
              <Link href="/dashboard/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative grid size-10 place-items-center rounded-full text-text-2 transition hover:text-gold-300">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread > 0 && <span className="tnum absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full bg-gold-300 px-1 text-[10px] font-bold text-ink">{unread}</span>}
              </Link>
              <UserMenu onSignOut={signOut} />
            </>
          ) : (
            <>
              <Link href="/login" className="text-[13px] text-text-2 transition hover:text-gold-300">
                Log in
              </Link>
              <LinkButton href="/register" size="sm">
                Sign up
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
