'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { formatDateTime, formatMoney } from '../lib/format';
import type { ListItem } from '../lib/types';
import { ItemCard } from './ItemCard';
import { useToast } from './Providers';
import { Button, Card, cx, EmptyState, ErrorState, Input, Pagination, Spinner, StatCard, Textarea } from './ui';

const tabs = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/messages', label: 'Messages' },
];

export const AdminTabs = () => {
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

interface AdminOverviewData {
  stats: { totalUsers: number; blockedUsers: number; liveAuctions: number; pendingApprovals: number; soldItems: number; totalBids: number; totalRevenue: number; newMessages: number };
  activity: { type: string; description: string; user: string; amount: number | null; link: string; at: string }[];
}

export const AdminOverview = () => {
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => api.get<AdminOverviewData>('/admin/dashboard') });
  if (overview.isPending) return <Spinner />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  const { stats, activity } = overview.data;
  const cards = [
    ['Users', stats.totalUsers],
    ['Live auctions', stats.liveAuctions],
    ['Pending approvals', stats.pendingApprovals],
    ['Total bids', stats.totalBids],
    ['Items sold', stats.soldItems],
    ['Revenue', formatMoney(stats.totalRevenue)],
    ['Blocked users', stats.blockedUsers],
    ['New messages', stats.newMessages],
  ] as const;

  return (
    <>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
      <h2 className="mb-4 text-xl font-semibold">Recent activity</h2>
      <Card className="divide-y divide-line py-0">
        {activity.map(entry => (
          <Link key={`${entry.type}-${entry.at}-${entry.description}`} href={entry.link} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-yellow">
            <span>
              {entry.description} <span className="text-muted">by {entry.user}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">
              {entry.amount !== null && `${formatMoney(entry.amount)} · `}
              {formatDateTime(entry.at)}
            </span>
          </Link>
        ))}
      </Card>
    </>
  );
};

interface PendingItem extends ListItem {
  seller: { id: number; username: string };
}

const ApprovalCard = ({ item }: { item: PendingItem }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const done = (message: string) => {
    toast('success', message);
    return Promise.all([queryClient.invalidateQueries({ queryKey: ['approvals'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]);
  };
  const approve = useMutation({ mutationFn: () => api.post(`/admin/approvals/${item.id}/approve`, {}), onSuccess: () => done('Listing approved.'), onError: error => toast('error', error.message) });
  const reject = useMutation({ mutationFn: () => api.post(`/admin/approvals/${item.id}/reject`, { rejectionReason: reason }), onSuccess: () => done('Listing rejected.'), onError: error => toast('error', error.message) });

  const submitRejection = (event: FormEvent) => {
    event.preventDefault();
    reject.mutate();
  };

  return (
    <Card className="grid gap-5 md:grid-cols-[240px_1fr]">
      <ItemCard item={item} />
      <div className="space-y-3">
        <p className="text-sm text-muted">Submitted by {item.seller.username}</p>
        <p className="text-sm whitespace-pre-line">{item.description || 'No description provided.'}</p>
        {rejecting ? (
          <form onSubmit={submitRejection} className="space-y-3">
            <Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason shown to the seller" required />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={reject.isPending}>
                Confirm rejection
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export const Approvals = () => {
  const [page, setPage] = useState(1);
  const approvals = useQuery({ queryKey: ['approvals', page], queryFn: () => api.page<PendingItem>(withQuery('/admin/approvals', { page })) });
  if (approvals.isPending) return <Spinner />;
  if (approvals.error) return <ErrorState message={approvals.error.message} />;
  if (approvals.data.items.length === 0) return <EmptyState title="Nothing waiting for review" />;
  return (
    <>
      <div className="space-y-5">
        {approvals.data.items.map(item => (
          <ApprovalCard key={item.id} item={item} />
        ))}
      </div>
      <Pagination meta={approvals.data.meta} onChange={setPage} />
    </>
  );
};

interface AdminUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'USER' | 'ADMIN';
  isBlocked: boolean;
  createdAt: string;
  itemCount: number;
  bidCount: number;
}

export const Users = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const users = useQuery({ queryKey: ['admin-users', q, page], queryFn: () => api.page<AdminUser>(withQuery('/admin/users', { q, page, pageSize: 15 })) });
  const toggleBlock = useMutation({
    mutationFn: (id: number) => api.patch(`/admin/users/${id}/block`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: error => toast('error', error.message),
  });

  return (
    <>
      <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name, username or email" className="mb-6 max-w-md" />
      {users.isPending && <Spinner />}
      {users.error && <ErrorState message={users.error.message} />}
      {users.data && (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  {['User', 'Email', 'Role', 'Listings', 'Bids', ''].map(heading => (
                    <th key={heading} className="px-4 py-3 font-normal">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.items.map(user => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      {user.username}
                      {user.isBlocked && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">blocked</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{user.email}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.itemCount}</td>
                    <td className="px-4 py-3">{user.bidCount}</td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== 'ADMIN' && (
                        <Button variant="secondary" disabled={toggleBlock.isPending} onClick={() => toggleBlock.mutate(user.id)}>
                          {user.isBlocked ? 'Unblock' : 'Block'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination meta={users.data.meta} onChange={setPage} />
        </>
      )}
    </>
  );
};

interface AdminMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  createdAt: string;
}

const MessageCard = ({ message }: { message: AdminMessage }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-messages'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]);
  const send = useMutation({
    mutationFn: () => api.post(`/admin/messages/${message.id}/reply`, { replyContent: reply }),
    onSuccess: () => {
      toast('success', 'Reply sent.');
      setReply('');
      return refresh();
    },
    onError: error => toast('error', error.message),
  });
  const archive = useMutation({ mutationFn: () => api.patch(`/admin/messages/${message.id}/status`, { status: 'ARCHIVED' }), onSuccess: refresh });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate();
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-medium">{message.subject}</p>
        <span className="text-xs text-muted capitalize">
          {message.status} · {formatDateTime(message.createdAt)}
        </span>
      </div>
      <p className="text-xs text-muted">
        {message.name} · {message.email}
      </p>
      <p className="text-sm whitespace-pre-line">{message.message}</p>
      {message.adminReply ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">
          <span className="text-yellow">Your reply: </span>
          {message.adminReply}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <Textarea value={reply} onChange={event => setReply(event.target.value)} placeholder="Write a reply" required />
          <div className="flex gap-2">
            <Button type="submit" disabled={send.isPending}>
              Send reply
            </Button>
            {message.status !== 'archived' && (
              <Button type="button" variant="ghost" onClick={() => archive.mutate()}>
                Archive
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
};

export const Messages = () => {
  const [page, setPage] = useState(1);
  const messages = useQuery({ queryKey: ['admin-messages', page], queryFn: () => api.page<AdminMessage>(withQuery('/admin/messages', { page })) });
  if (messages.isPending) return <Spinner />;
  if (messages.error) return <ErrorState message={messages.error.message} />;
  if (messages.data.items.length === 0) return <EmptyState title="No messages" />;
  return (
    <>
      <div className="space-y-4">
        {messages.data.items.map(message => (
          <MessageCard key={message.id} message={message} />
        ))}
      </div>
      <Pagination meta={messages.data.meta} onChange={setPage} />
    </>
  );
};
