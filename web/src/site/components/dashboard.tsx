'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import type { AppNotification, ListItem } from '../lib/types';
import { ItemGrid, NoItems } from './ItemGrid';
import { ItemCard } from './ItemCard';
import { useToast } from './Providers';
import { Button, Card, cx, EmptyState, ErrorState, LinkButton, Select, Spinner, StatCard } from './ui';

const tabs = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/bids', label: 'My bids' },
  { href: '/dashboard/won', label: 'Won' },
  { href: '/dashboard/watchlist', label: 'Watchlist' },
  { href: '/dashboard/notifications', label: 'Notifications' },
  { href: '/dashboard/messages', label: 'Messages' },
];

export const DashboardTabs = () => {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href} className={cx('-mb-px border-b-2 px-4 py-3 text-sm whitespace-nowrap transition', pathname === tab.href ? 'border-yellow text-white' : 'border-transparent text-muted hover:text-white')}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};

interface Overview {
  stats: { activeBids: number; leading: number; won: number; watching: number; unreadNotifications: number };
  endingSoon: ListItem[];
}

export const DashboardOverview = () => {
  const overview = useQuery({ queryKey: ['me-dashboard'], queryFn: () => api.get<Overview>('/me/dashboard') });
  if (overview.isPending) return <Spinner />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  const { stats, endingSoon } = overview.data;

  return (
    <>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active bids" value={stats.activeBids} />
        <StatCard label="Currently leading" value={stats.leading} />
        <StatCard label="Auctions won" value={stats.won} />
        <StatCard label="Watching" value={stats.watching} />
      </div>
      <h2 className="mb-4 text-xl font-semibold">Ending soon, where you bid</h2>
      {endingSoon.length === 0 ? (
        <EmptyState title="You have no live bids" hint="Find something you like and place your first bid." action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {endingSoon.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
};

type BidFilter = 'all' | 'active' | 'leading' | 'won' | 'lost';
const bidFilters: BidFilter[] = ['all', 'active', 'leading', 'won', 'lost'];

interface BidItem extends ListItem {
  myHighestBid: number | null;
  isLeading: boolean;
}

export const MyBids = () => {
  const [filter, setFilter] = useState<BidFilter>('all');
  return (
    <>
      <div className="mb-6 flex gap-2">
        {bidFilters.map(option => (
          <Button key={option} variant={option === filter ? 'primary' : 'secondary'} className="capitalize" onClick={() => setFilter(option)}>
            {option}
          </Button>
        ))}
      </div>
      <ItemGrid<BidItem>
        key={filter}
        path="/me/bids"
        params={{ filter }}
        empty={<NoItems title="No auctions here yet" hint="Items you bid on will show up here." />}
        renderFooter={item => <p className="px-1 text-xs text-muted">Your highest bid: {formatMoney(item.myHighestBid)}{item.isLeading && item.status === 'active' ? ' · leading' : ''}</p>}
      />
    </>
  );
};

export const Watchlist = () => <ItemGrid path="/me/watchlist" empty={<NoItems title="Your watchlist is empty" hint="Add items from an auction page to track them here." />} />;

interface WonItem extends ListItem {
  seller: { id: number; username: string };
  paid: boolean;
  myRating: { score: number; comment: string | null } | null;
}

const WonCard = ({ item }: { item: WonItem }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [score, setScore] = useState('5');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['won'] });
  const pay = useMutation({
    mutationFn: () => api.post(`/me/won/${item.id}/pay`),
    onSuccess: () => {
      toast('success', 'Payment complete.');
      return refresh();
    },
    onError: error => toast('error', error.message),
  });
  const rate = useMutation({
    mutationFn: () => api.post(`/me/won/${item.id}/rating`, { score: Number(score) }),
    onSuccess: () => {
      toast('success', 'Thanks for rating the seller.');
      return refresh();
    },
    onError: error => toast('error', error.message),
  });

  return (
    <Card className="grid gap-5 sm:grid-cols-[200px_1fr]">
      <ItemCard item={item} />
      <div className="space-y-3 self-center">
        <h3 className="text-lg font-medium">{item.title}</h3>
        <p className="text-sm text-muted">Won for {formatMoney(item.currentPrice)} · seller {item.seller.username}</p>
        {item.paid ? (
          item.myRating ? (
            <p className="text-sm text-emerald-300">Paid · you rated the seller {item.myRating.score}★</p>
          ) : (
            <div className="flex items-center gap-2">
              <Select value={score} onChange={event => setScore(event.target.value)} className="w-32" aria-label="Rating">
                {[5, 4, 3, 2, 1].map(value => (
                  <option key={value} value={value}>
                    {value} stars
                  </option>
                ))}
              </Select>
              <Button variant="secondary" disabled={rate.isPending} onClick={() => rate.mutate()}>
                Rate seller
              </Button>
            </div>
          )
        ) : (
          <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? 'Processing…' : `Pay ${formatMoney(item.currentPrice)}`}
          </Button>
        )}
      </div>
    </Card>
  );
};

export const WonAuctions = () => {
  const won = useQuery({ queryKey: ['won'], queryFn: () => api.get<WonItem[]>('/me/won') });
  if (won.isPending) return <Spinner />;
  if (won.error) return <ErrorState message={won.error.message} />;
  if (won.data.length === 0) return <EmptyState title="You haven't won an auction yet" action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />;
  return (
    <div className="space-y-5">
      {won.data.map(item => (
        <WonCard key={item.id} item={item} />
      ))}
    </div>
  );
};

export const Notifications = () => {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api.page<AppNotification>('/me/notifications?pageSize=50') });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['notifications'] }), queryClient.invalidateQueries({ queryKey: ['unread'] })]);
  const markAll = useMutation({ mutationFn: () => api.post('/me/notifications/read-all'), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: number) => api.post(`/me/notifications/${id}/read`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api.delete(`/me/notifications/${id}`), onSuccess: refresh });

  if (notifications.isPending) return <Spinner />;
  if (notifications.error) return <ErrorState message={notifications.error.message} />;
  const { items } = notifications.data;

  return (
    <>
      {items.some(item => !item.isRead) && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id}>
              <Card className={cx('flex items-start justify-between gap-4', !item.isRead && 'border-yellow/40')}>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted">{item.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                  {item.link && (
                    <Link href={item.link} onClick={() => markOne.mutate(item.id)} className="mt-2 inline-block text-sm text-yellow hover:underline">
                      View
                    </Link>
                  )}
                </div>
                <div className="flex gap-2">
                  {!item.isRead && (
                    <Button variant="ghost" onClick={() => markOne.mutate(item.id)}>
                      Mark read
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => remove.mutate(item.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

interface MyMessage {
  id: number;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  createdAt: string;
}

export const MyMessages = () => {
  const messages = useQuery({ queryKey: ['my-messages'], queryFn: () => api.get<MyMessage[]>('/me/messages') });
  if (messages.isPending) return <Spinner />;
  if (messages.error) return <ErrorState message={messages.error.message} />;
  if (messages.data.length === 0) return <EmptyState title="You haven't contacted support" hint="Messages you send from the contact form appear here with our replies." />;
  return (
    <div className="space-y-4">
      {messages.data.map(message => (
        <Card key={message.id} className="space-y-2">
          <div className="flex justify-between gap-4">
            <p className="font-medium">{message.subject}</p>
            <span className="text-xs text-muted capitalize">{message.status} · {formatDateTime(message.createdAt)}</span>
          </div>
          <p className="text-sm text-muted">{message.message}</p>
          {message.adminReply && <p className="rounded-xl bg-surface-2 p-3 text-sm"><span className="text-yellow">Support: </span>{message.adminReply}</p>}
        </Card>
      ))}
    </div>
  );
};
