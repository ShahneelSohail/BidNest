'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatAgo, initials, type AdminOverviewData } from '../lib/admin';
import { useNow } from '../lib/hooks';
import { useAuth, useToast } from './Providers';
import { Button, cx, Eyebrow, ErrorState, Spinner } from './ui';

const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  check: 'M20 6 9 17l-5-5',
  approvals: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  tree: 'M3 3h7v4H3zM14 10h7v4h-7zM14 17h7v4h-7zM6.5 7v10.5a1.5 1.5 0 0 0 1.5 1.5h6M6.5 12H14',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  gavel: 'm14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  item: 'M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  search: 'M21 21l-4.3-4.3M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  plus: 'M5 12h14M12 5v14',
  close: 'M18 6 6 18M6 6l12 12',
  next: 'm9 18 6-6-6-6',
  prev: 'm15 18-6-6 6-6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, size = 16, filled }: { name: IconName; size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
);

const OVERVIEW_REFRESH_MS = 15_000;

export const useAdminOverview = () =>
  useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<AdminOverviewData>('/admin/dashboard'), refetchInterval: OVERVIEW_REFRESH_MS });

export const useAdminMutation = <V = void,>(mutationFn: (variables: V) => Promise<unknown>, success?: string | ((variables: V) => string), undo?: (variables: V) => Promise<unknown>) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      const undoAction = undo && {
        label: 'Undo',
        onClick: () =>
          void undo(variables).then(
            () => {
              toast('success', 'Decision undone.');
              return refresh();
            },
            (error: Error) => toast('error', error.message)
          ),
      };
      if (success) toast('success', typeof success === 'function' ? success(variables) : success, undoAction);
      return refresh();
    },
    onError: error => toast('error', error.message),
  });
};

export const Async = <T,>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) => {
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  return children(query.data);
};

type BadgeTone = 'gold' | 'info';
type StatKey = keyof AdminOverviewData['stats'];

const badgeStyles: Record<BadgeTone, string> = { gold: 'bg-gold-300 text-ink', info: 'bg-info/16 text-info' };

const sections: { title: string; links: { href: string; label: string; icon: IconName; badge?: { stat: StatKey; tone: BadgeTone } }[] }[] = [
  {
    title: 'Console',
    links: [
      { href: '/admin', label: 'Overview', icon: 'grid' },
      { href: '/admin/approvals', label: 'Approvals', icon: 'approvals', badge: { stat: 'pendingApprovals', tone: 'gold' } },
      { href: '/admin/users', label: 'Users', icon: 'users' },
      { href: '/admin/listings', label: 'Listings', icon: 'list' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { href: '/admin/categories', label: 'Categories', icon: 'tree' },
      { href: '/admin/bids', label: 'Bids monitor', icon: 'pulse' },
      { href: '/admin/messages', label: 'Messages', icon: 'msg', badge: { stat: 'newMessages', tone: 'info' } },
    ],
  },
];

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const stats = useAdminOverview().data?.stats;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-0 lg:border lg:border-line">
      <aside className="flex flex-col bg-surface lg:border-r lg:border-line lg:px-3.5 lg:py-7">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {sections.map((section, sectionIndex) => (
            <div key={section.title} className="contents">
              <p className={cx('mx-3 mb-2.5 hidden text-[10px] font-semibold tracking-[0.22em] text-muted uppercase lg:block', sectionIndex ? 'mt-9' : 'mt-0')}>{section.title}</p>
              {section.links.map(link => {
                const active = link.href === '/admin' ? pathname === link.href : pathname.startsWith(link.href);
                const count = link.badge && stats?.[link.badge.stat];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx('flex h-11 items-center gap-3 border-l-2 px-3 text-sm whitespace-nowrap transition', active ? 'border-gold-300 bg-surface-2 text-text' : 'border-transparent text-text-2 hover:bg-surface-2 hover:text-text')}
                  >
                    <Icon name={link.icon} size={17} />
                    <span className="flex-1">{link.label}</span>
                    {link.badge && count ? <span className={cx('tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold', badgeStyles[link.badge.tone])}>{count}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {user && (
          <div className="mx-3 mt-auto hidden border-t border-line pt-5 lg:block">
            <p className="text-[13px] font-semibold">{user.fullName}</p>
            <p className="mt-0.5 text-xs text-muted">Administrator</p>
          </div>
        )}
      </aside>
      <div className="min-w-0 lg:px-12 lg:py-12">{children}</div>
    </div>
  );
};

export const AdminTitle = ({ eyebrow, title, action }: { eyebrow: ReactNode; title: string; action?: ReactNode }) => (
  <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h1 className="display text-5xl md:text-[64px] md:leading-none">{title}</h1>
    </div>
    {action}
  </div>
);

export const SectionHead = ({ title, aside }: { title: string; aside?: ReactNode }) => (
  <div className="mb-1 flex items-baseline justify-between gap-4 border-b border-line-strong pb-3.5">
    <h2 className="display text-3xl">{title}</h2>
    {aside && <span className="text-xs text-muted">{aside}</span>}
  </div>
);

const pillTones = {
  live: 'bg-live/12 text-live',
  warn: 'bg-outbid/14 text-outbid',
  danger: 'bg-danger/14 text-danger',
  info: 'bg-info/12 text-info',
  neutral: 'bg-white/8 text-text-2',
  gold: 'bg-gold-300/12 text-gold-300',
} as const;

export type PillTone = keyof typeof pillTones;

export const Pill = ({ tone, children }: { tone: PillTone; children: ReactNode }) => (
  <span className={cx('inline-flex h-[22px] items-center rounded-full px-2.5 text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase', pillTones[tone])}>{children}</span>
);

export const FilterChips = <T extends string>({ options, value, onChange }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(option => (
      <button
        key={option.key}
        aria-pressed={option.key === value}
        onClick={() => onChange(option.key)}
        className={cx('flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition', option.key === value ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-line-strong text-text hover:border-gold-300')}
      >
        {option.label}
        {option.count !== undefined && <span className="tnum text-[11px] text-muted">{option.count}</span>}
      </button>
    ))}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) => (
  <label className="flex h-11 w-full max-w-sm items-center gap-2.5 rounded-full border border-line-strong bg-surface px-3.5 text-muted transition focus-within:border-gold-300">
    <Icon name="search" />
    <input aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted" />
  </label>
);

const avatarSizes = { sm: 'size-9 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-2xl display' } as const;

export const Avatar = ({ name, size = 'sm', blocked }: { name: string; size?: keyof typeof avatarSizes; blocked?: boolean }) => (
  <span className={cx('grid shrink-0 place-items-center rounded-full border bg-surface-3 font-semibold text-gold-300', blocked ? 'border-danger' : 'border-line-strong', avatarSizes[size])}>{initials(name)}</span>
);

export const thClass = 'h-11 px-3 text-left text-[10.5px] font-semibold tracking-[0.18em] text-muted uppercase border-b border-line';
export const tdClass = 'border-b border-line-neutral px-3 py-3';

export const Drawer = ({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/55 transition-opacity duration-300 starting:opacity-0" />
      <aside role="dialog" aria-label={title} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-line-strong bg-surface-2 shadow-e3 transition-transform duration-[420ms] ease-(--ease-expo) starting:translate-x-full">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-6">
          <Eyebrow className="text-muted!">{title}</Eyebrow>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full text-text-2 transition hover:bg-surface-3 hover:text-text">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-7">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </>
  );
};

export const ConfirmButton = ({ label, prompt, confirmLabel, onConfirm, disabled }: { label: string; prompt: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean }) => {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="mr-1 text-[12.5px] text-danger">{prompt}</span>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
        Cancel
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="danger" disabled={disabled} onClick={() => setAsking(true)}>
      {label}
    </Button>
  );
};

const HOUR_MS = 3_600_000;

export const BidsChart = ({ values }: { values: number[] }) => {
  const now = useNow(60_000);
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  const hourLabel = (index: number) => `${String(new Date(now - (values.length - 1 - index) * HOUR_MS).getHours()).padStart(2, '0')}:00`;
  const slot = 240 / values.length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-xs text-muted">
        <span>Last 24 hours</span>
        {values[peak] > 0 && <span>peak {hourLabel(peak)}</span>}
      </div>
      <svg viewBox="0 0 240 100" preserveAspectRatio="none" className="h-36 w-full border-b border-line-strong" role="img" aria-label="Bids per hour over the last 24 hours">
        {values.map((value, index) => (
          <rect key={index} x={index * slot + 1} y={100 - (value / max) * 100} width={slot - 2} height={(value / max) * 100} className={cx('transition-colors', index === peak && value > 0 ? 'fill-gold-300' : 'fill-gold-300/40 hover:fill-gold-300')}>
            <title>{`${hourLabel(index)} · ${value} bids`}</title>
          </rect>
        ))}
      </svg>
      <div className="tnum mt-2 flex justify-between text-[11px] text-muted">
        <span>{hourLabel(0)}</span>
        <span>{hourLabel(Math.floor(values.length / 2))}</span>
        <span>Now</span>
      </div>
    </div>
  );
};

export const Ago = ({ at }: { at: string }) => {
  const now = useNow(30_000);
  return <span suppressHydrationWarning>{formatAgo(at, now)}</span>;
};
