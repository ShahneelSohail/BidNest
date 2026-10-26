'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatMoney, plural } from '../lib/format';
import { formatShortDate, formatWeekday, greeting, timeAgo } from '../lib/time';
import type { AppNotification, ListItem } from '../lib/types';
import { Icon, type IconName } from './dashboard-icons';
import { Countdown, lotNumber } from './ItemCard';
import { NoItems, PagedItems } from './ItemGrid';
import { useAuth, useToast } from './Providers';
import { Button, cx, ErrorState, LinkButton, Spinner, Tabs } from './ui';

interface DashboardStats {
  activeBids: number;
  leading: number;
  won: number;
  watching: number;
  unreadNotifications: number;
}

interface BidState {
  myHighestBid: number | null;
  isLeading: boolean;
  isWinner?: boolean;
  paid?: boolean;
}

export type BidRow = ListItem & BidState;

interface WonSummary extends ListItem {
  paid: boolean;
}

const useDashboardOverview = () => useQuery({ queryKey: ['me-dashboard'], queryFn: () => api.get<{ stats: DashboardStats; endingSoon: BidRow[] }>('/me/dashboard') });

const sections: { href: string; label: string; short: string; icon: IconName; mobile: boolean; count?: (stats: DashboardStats) => number }[] = [
  { href: '/dashboard', label: 'Overview', short: 'Home', icon: 'grid', mobile: true },
  { href: '/dashboard/bids', label: 'My bids', short: 'Bids', icon: 'gavel', mobile: true, count: stats => stats.activeBids },
  { href: '/dashboard/won', label: 'Won', short: 'Won', icon: 'trophy', mobile: true, count: stats => stats.won },
  { href: '/dashboard/watchlist', label: 'Watchlist', short: 'Watch', icon: 'heart', mobile: true, count: stats => stats.watching },
  { href: '/dashboard/notifications', label: 'Notifications', short: 'Alerts', icon: 'bell', mobile: true, count: stats => stats.unreadNotifications },
  { href: '/dashboard/support', label: 'Support', short: 'Support', icon: 'message', mobile: false },
];

const isCurrent = (pathname: string, href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

export const DashboardShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const stats = useDashboardOverview().data?.stats;
  const countOf = (section: (typeof sections)[number]) => (stats && section.count ? section.count(stats) : 0);

  return (
    <div className="grid gap-x-14 pb-20 lg:grid-cols-[264px_minmax(0,1fr)] lg:pb-0">
      <aside className="hidden self-start border border-line bg-surface px-4 py-8 lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-0.5">
        <div className="mb-7 px-3">
          <p className="display text-[22px]">{user?.fullName}</p>
          <p className="mt-1 text-xs text-muted">@{user?.username} · member since {user && new Date(user.createdAt).getFullYear()}</p>
        </div>
        <p className="mb-2.5 px-3 text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">Buying</p>
        {sections.map(section => {
          const current = isCurrent(pathname, section.href);
          const count = countOf(section);
          return (
            <Link key={section.href} href={section.href} aria-current={current ? 'page' : undefined} className={cx('flex h-11 items-center gap-3 px-3 text-sm shadow-[inset_2px_0_0_transparent] transition hover:bg-surface-2 hover:text-text', current ? 'bg-surface-2 text-text shadow-[inset_2px_0_0_var(--color-gold-300)]' : 'text-text-2')}>
              <Icon name={section.icon} />
              <span className="flex-1">{section.label}</span>
              {count > 0 && <span className={cx('tnum text-[11px]', current ? 'text-gold-300' : 'text-muted')}>{count}</span>}
            </Link>
          );
        })}
        <div className="mx-3 mt-7 flex flex-col gap-2.5 border-t border-line pt-6">
          <p className="text-[13px] leading-normal text-text-2">Have something worth bidding on?</p>
          <LinkButton href="/sell" variant="secondary" size="sm" className="self-start">
            Start selling
          </LinkButton>
        </div>
        <Link href="/settings" className="mt-10 flex h-11 items-center gap-3 px-3 text-sm text-muted transition hover:text-text">
          <Icon name="settings" />
          Settings
        </Link>
      </aside>
      <div className="min-w-0">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/90 px-2 pt-2 pb-5 backdrop-blur-xl lg:hidden">
        {sections
          .filter(section => section.mobile)
          .map(section => {
            const current = isCurrent(pathname, section.href);
            const count = countOf(section);
            return (
              <Link key={section.href} href={section.href} aria-current={current ? 'page' : undefined} className={cx('relative flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium', current ? 'text-gold-300' : 'text-muted')}>
                <span className={cx('absolute -top-2 h-0.5 w-5', current ? 'bg-gold-300' : 'bg-transparent')} />
                <Icon name={section.icon} size={22} />
                {section.short}
                {section.href === '/dashboard/notifications' && count > 0 && <span className="absolute top-0.5 left-1/2 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-300 px-1 text-[9.5px] font-bold text-ink">{count}</span>}
              </Link>
            );
          })}
      </nav>
    </div>
  );
};

export const SectionHeading = ({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) => (
  <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="display text-5xl md:text-6xl">{title}</h1>
    </div>
    {aside && <div className="tnum text-sm text-muted">{aside}</div>}
  </div>
);

const pillTones = {
  leading: 'border-live/45 text-live',
  outbid: 'border-outbid/45 text-outbid',
  won: 'border-gold-300 bg-gold-300 text-ink',
  lost: 'border-white/12 text-ended',
} as const;

const pillIcons: Record<BidStatus, IconName> = { leading: 'up', outbid: 'down', won: 'check', lost: 'x' };

type BidStatus = keyof typeof pillTones;

const bidStatus = (item: BidRow): BidStatus => (item.status === 'active' ? (item.isLeading ? 'leading' : 'outbid') : item.isWinner ? 'won' : 'lost');

const StatusPill = ({ status, className }: { status: BidStatus; className?: string }) => (
  <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase', pillTones[status], className)}>
    <Icon name={pillIcons[status]} size={10} strokeWidth={2.4} />
    {status}
  </span>
);

const useRebid = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: ListItem) => api.post(`/items/${item.id}/bids`, { amount: item.currentPrice + item.bidIncrement }),
    onSuccess: (_, item) => {
      toast('success', `Bid placed. You lead ${lotNumber(item.id)}.`);
      return queryClient.invalidateQueries();
    },
    onError: error => toast('error', error.message),
  });
};

const BidCta = ({ item, size = 'sm', className }: { item: BidRow; size?: 'sm' | 'md'; className?: string }) => {
  const rebid = useRebid();
  const status = bidStatus(item);
  if (status === 'outbid') {
    return (
      <Button size={size} disabled={rebid.isPending} className={cx('tnum', className)} onClick={() => rebid.mutate(item)}>
        Bid {formatMoney(item.currentPrice + item.bidIncrement)}
      </Button>
    );
  }
  const owed = status === 'won' && !item.paid;
  const [label, href] = {
    leading: ['Raise max', `/auctions/${item.id}`],
    won: [owed ? 'Pay now' : 'View receipt', `/checkout/${item.id}`],
    lost: ['Similar lots', '/auctions'],
  }[status];
  return (
    <LinkButton href={href} size={size} variant={owed ? 'gold' : 'secondary'} className={className}>
      {label}
    </LinkButton>
  );
};

const EndingCard = ({ item }: { item: BidRow }) => {
  const status = bidStatus(item);
  return (
    <div className="rise flex w-64 shrink-0 flex-col gap-4 md:w-auto">
      <Link href={`/auctions/${item.id}`} className={cx('group relative block aspect-[4/3] overflow-hidden border bg-surface-2', status === 'leading' ? 'border-live/25' : 'border-outbid/30')}>
        {item.primaryImage && <img src={item.primaryImage} alt={item.title} loading="lazy" className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:scale-105" />}
        <StatusPill status={status} className="absolute top-3 left-3 bg-ink/80 backdrop-blur" />
        <span className="absolute bottom-3 left-3 inline-flex h-[26px] items-center gap-1.5 rounded-full bg-ink/80 px-2.5 text-xs font-semibold">
          <Icon name="clock" size={12} strokeWidth={1.75} />
          <Countdown endDate={item.endDate} />
        </span>
      </Link>
      <div className="flex flex-col gap-1.5">
        <p className="text-[10.5px] font-semibold tracking-[0.22em] text-muted uppercase">
          {lotNumber(item.id)} · {item.category?.name ?? 'Uncategorised'}
        </p>
        <p className="display text-2xl leading-[1.15]">{item.title}</p>
      </div>
      <div className="grid grid-cols-2 border-t border-line pt-3">
        <div>
          <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">Current</p>
          <p key={item.currentPrice} className="display flash tnum text-2xl text-gold-300">
            {formatMoney(item.currentPrice)}
          </p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">Your bid</p>
          <p className="display tnum text-2xl text-text-2">{formatMoney(item.myHighestBid)}</p>
        </div>
      </div>
      <BidCta item={item} size="md" />
    </div>
  );
};

const PanelHeading = ({ title, href }: { title: string; href: string }) => (
  <div className="flex items-baseline justify-between border-b border-line-strong pb-3.5">
    <h3 className="display text-[28px]">{title}</h3>
    <Link href={href} className="text-[13px] text-text-2 transition hover:text-gold-300">
      See all
    </Link>
  </div>
);

const RecentActivity = () => {
  const notifications = useQuery({ queryKey: ['notifications', 'recent'], queryFn: () => api.page<AppNotification>('/me/notifications?pageSize=4') });
  return (
    <div>
      <PanelHeading title="Recent activity" href="/dashboard/notifications" />
      {notifications.data?.items.map(note => (
        <div key={note.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-neutral py-3.5">
          <span className="grid size-8 place-items-center rounded-full bg-gold-300/12 text-gold-300">
            <Icon name="bell" size={14} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className={cx('text-sm', note.isRead ? 'font-medium' : 'font-semibold')}>{note.title}</p>
            <p className="mt-0.5 truncate text-[13px] text-muted">{note.message}</p>
          </div>
          <span className="text-xs text-muted">{timeAgo(note.createdAt)}</span>
        </div>
      ))}
      {notifications.data?.items.length === 0 && <p className="py-6 text-sm text-muted">Nothing yet. Bid on a lot and your activity shows up here.</p>}
    </div>
  );
};

const WatchPreview = () => {
  const watched = useQuery({ queryKey: ['watch-preview'], queryFn: () => api.page<ListItem>('/me/watchlist?pageSize=3') });
  return (
    <div>
      <PanelHeading title="From your watchlist" href="/dashboard/watchlist" />
      {watched.data?.items.map(item => (
        <Link key={item.id} href={`/auctions/${item.id}`} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-neutral py-3">
          {item.primaryImage ? <img src={item.primaryImage} alt="" className="size-14 object-cover" /> : <span className="size-14 bg-surface-2" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs">{item.status === 'active' ? <Countdown endDate={item.endDate} /> : <span className="text-muted capitalize">{item.status}</span>}</p>
          </div>
          <span className="display text-[19px] text-gold-300">{formatMoney(item.currentPrice)}</span>
        </Link>
      ))}
      {watched.data?.items.length === 0 && <p className="py-6 text-sm text-muted">Tap the heart on any lot to follow it here.</p>}
    </div>
  );
};

export const DashboardOverview = () => {
  const { user } = useAuth();
  const overview = useDashboardOverview();
  const won = useQuery({ queryKey: ['won'], queryFn: () => api.get<WonSummary[]>('/me/won') });
  if (overview.isPending) return <Spinner />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  const { stats, endingSoon } = overview.data;
  const unpaid = won.data?.filter(item => !item.paid) ?? [];
  const payDue = unpaid[0];
  const outbid = stats.activeBids - stats.leading;
  const summary = `You're leading ${stats.leading} of ${stats.activeBids} live bids${outbid ? `, and outbid on ${outbid}` : ''}.${unpaid.length ? ` ${unpaid.length === 1 ? 'One lot needs' : `${unpaid.length} lots need`} payment.` : ''}`;
  const tiles = [
    { href: '/dashboard/bids', label: 'Active bids', value: stats.activeBids, sub: `${stats.leading} leading`, subClass: 'text-muted' },
    { href: '/dashboard/bids', label: 'Leading', value: stats.leading, sub: 'Highest bidder right now', subClass: 'text-live', gold: true },
    { href: '/dashboard/won', label: 'Won', value: stats.won, sub: unpaid.length ? `${unpaid.length} awaiting payment` : 'All paid', subClass: unpaid.length ? 'text-outbid' : 'text-muted' },
    { href: '/dashboard/watchlist', label: 'Watching', value: stats.watching, sub: `${stats.unreadNotifications} unread alerts`, subClass: 'text-muted' },
  ];

  return (
    <div className="rise flex flex-col gap-14 lg:gap-16">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">{formatWeekday(new Date())}</p>
        <h1 className="display text-5xl leading-none md:text-7xl lg:text-[80px]">
          {greeting(new Date().getHours())}, {user?.fullName.split(' ')[0]}.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-text-2 md:text-[17px]">{summary}</p>
      </div>
      {payDue && (
        <div className="grid items-center gap-5 border border-gold-300/40 bg-surface-2 p-5 shadow-e2 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-7">
          {payDue.primaryImage ? <img src={payDue.primaryImage} alt="" className="size-24 object-cover" /> : <span className="size-24 bg-surface" />}
          <div>
            <p className="eyebrow mb-1.5">Awaiting payment · {lotNumber(payDue.id)}</p>
            <p className="display text-[28px] leading-[1.1]">{payDue.title}</p>
            <p className="tnum mt-1.5 text-[13px] text-text-2">
              <span className="font-semibold text-outbid">{formatMoney(payDue.currentPrice)}</span> hammer price plus delivery · seller ships within 3 days of payment
            </p>
          </div>
          <LinkButton href={`/checkout/${payDue.id}`} variant="gold" size="lg">
            Pay now
            <Icon name="arrow" size={16} />
          </LinkButton>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4 lg:gap-x-10">
        {tiles.map(tile => (
          <Link key={tile.label} href={tile.href} className={cx('border-t pt-4 transition hover:border-gold-300', tile.gold ? 'border-gold-300/45' : 'border-line')}>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">{tile.label}</p>
            <p className={cx('display tnum my-3 text-6xl leading-none lg:text-7xl', tile.gold && 'text-gold-300')}>{tile.value}</p>
            <p className={cx('text-[13px]', tile.subClass)}>{tile.sub}</p>
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-7">
        <div className="flex items-end justify-between border-b border-line pb-5">
          <div>
            <p className="eyebrow mb-2.5 text-outbid!">Your lots, closing first</p>
            <h2 className="display text-3xl leading-[1.08] md:text-[40px]">Ending soon where you bid</h2>
          </div>
          <Link href="/dashboard/bids" className="inline-flex items-center gap-1.5 text-sm text-text-2 transition hover:text-gold-300">
            All bids
            <Icon name="arrow" size={15} />
          </Link>
        </div>
        {endingSoon.length === 0 ? (
          <NoItems title="You have no live bids" hint="Find something you like and place your first bid." action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />
        ) : (
          <div className="-mx-6 flex gap-4 overflow-x-auto px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 xl:grid-cols-3">
            {endingSoon.slice(0, 3).map(item => (
              <EndingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-12 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:gap-14">
        <RecentActivity />
        <WatchPreview />
      </div>
    </div>
  );
};

const bidFilters = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'leading', label: 'Leading' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const;

type BidFilter = (typeof bidFilters)[number]['key'];

const bidColumns = [
  { label: 'Lot', align: 'text-left' },
  { label: 'Status', align: 'text-left' },
  { label: 'Your bid', align: 'text-right' },
  { label: 'Current', align: 'text-right' },
  { label: 'Time', align: 'text-right' },
  { label: '', align: 'text-right' },
];

const TimeLeft = ({ item }: { item: BidRow }) => (item.status === 'active' ? <Countdown endDate={item.endDate} /> : <span className="text-muted">Ended {formatShortDate(item.endDate)}</span>);

const BidThumb = ({ item, className }: { item: BidRow; className: string }) =>
  item.primaryImage ? <img src={item.primaryImage} alt="" className={cx('object-cover', className, bidStatus(item) === 'lost' && 'opacity-50')} /> : <span className={cx('bg-surface-2', className)} />;

export const MyBids = () => {
  const [filter, setFilter] = useState<BidFilter>('all');
  return (
    <>
      <SectionHeading eyebrow="Buying" title="My bids" />
      <Tabs tabs={bidFilters.map(({ key, label }) => ({ key, label }))} value={filter} onChange={setFilter} />
      <PagedItems<BidRow> key={filter} path="/me/bids" params={{ filter }} empty={<NoItems title="Nothing here" hint="Items you bid on will show up here." />}>
        {items => (
          <>
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr>
                  {bidColumns.map(column => (
                    <th key={column.label} className={cx('h-11 border-b border-line px-3 text-[10.5px] font-semibold tracking-[0.18em] text-muted uppercase', column.align)}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = bidStatus(item);
                  return (
                    <tr key={item.id} className="rise transition hover:bg-gold-300/[0.03]">
                      <td className="border-b border-line-neutral px-3 py-3.5">
                        <Link href={`/auctions/${item.id}`} className="flex items-center gap-4">
                          <BidThumb item={item} className="size-14" />
                          <div>
                            <p className="display text-[19px] leading-tight">{item.title}</p>
                            <p className="mt-1 text-xs text-muted">
                              {lotNumber(item.id)} · {plural(item.bidCount, 'bid')}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="border-b border-line-neutral px-3">
                        <StatusPill status={status} />
                      </td>
                      <td className="tnum border-b border-line-neutral px-3 text-right text-text-2">{formatMoney(item.myHighestBid)}</td>
                      <td className={cx('display tnum border-b border-line-neutral px-3 text-right text-xl', status === 'lost' ? 'text-muted' : 'text-gold-300')}>{formatMoney(item.currentPrice)}</td>
                      <td className="tnum border-b border-line-neutral px-3 text-right">
                        <TimeLeft item={item} />
                      </td>
                      <td className="w-44 border-b border-line-neutral px-3 text-right">
                        <BidCta item={item} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="md:hidden">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3.5 border-b border-line py-4">
                  <BidThumb item={item} className="h-20 w-16" />
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill status={bidStatus(item)} />
                      <span className="tnum text-xs">
                        <TimeLeft item={item} />
                      </span>
                    </div>
                    <Link href={`/auctions/${item.id}`} className="display text-lg leading-tight">
                      {item.title}
                    </Link>
                    <p className="tnum text-xs text-muted">
                      <span className="display text-[17px] text-gold-300">{formatMoney(item.currentPrice)}</span> · your bid {formatMoney(item.myHighestBid)}
                    </p>
                    <BidCta item={item} className="self-start" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PagedItems>
    </>
  );
};

export const Watchlist = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/items/${id}/watch`),
    onSuccess: () => {
      toast('success', 'Removed from your watchlist.');
      return queryClient.invalidateQueries();
    },
    onError: error => toast('error', error.message),
  });

  return (
    <>
      <SectionHeading eyebrow="Buying" title="Watchlist" />
      <PagedItems
        path="/me/watchlist"
        empty={
          <div className="flex flex-col items-center gap-4 border-t border-line py-16 text-center">
            <div className="gavel-mask h-24 w-36" />
            <p className="display text-4xl">Your watchlist is empty</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">Tap the heart on any lot to follow its price and keep it close.</p>
            <LinkButton href="/auctions">Browse live auctions</LinkButton>
          </div>
        }
      >
        {items => (
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 md:gap-7 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(item => (
              <div key={item.id} className="rise relative flex flex-col gap-3.5">
                <Link href={`/auctions/${item.id}`} className="group block aspect-[4/5] overflow-hidden border border-line bg-surface-2">
                  {item.primaryImage && <img src={item.primaryImage} alt={item.title} loading="lazy" className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:scale-105" />}
                </Link>
                <button onClick={() => remove.mutate(item.id)} disabled={remove.isPending} aria-label="Remove from watchlist" className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-gold-300 text-ink transition hover:bg-gold-100">
                  <Icon name="heart" size={15} filled />
                </button>
                <div>
                  <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.22em] text-muted uppercase">
                    {lotNumber(item.id)} · {item.category?.name ?? 'Uncategorised'}
                  </p>
                  <p className="display text-[22px] leading-[1.15]">{item.title}</p>
                </div>
                <div className="flex items-end justify-between border-t border-line pt-2.5">
                  <span className="display text-[22px] text-gold-300">{formatMoney(item.currentPrice)}</span>
                  <span className="text-xs">{item.status === 'active' ? <Countdown endDate={item.endDate} /> : <span className="text-muted capitalize">{item.status}</span>}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PagedItems>
    </>
  );
};
