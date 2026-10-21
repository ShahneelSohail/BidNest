'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api, withQuery } from '../lib/api';
import { formatMonthYear, type AdminUser, type AdminUserDetail } from '../lib/admin';
import { formatMoney } from '../lib/format';
import { useDebounced } from '../lib/hooks';
import { Async, AdminTitle, Avatar, ConfirmButton, Drawer, FilterChips, Icon, Pill, SearchBox, tdClass, thClass, useAdminMutation } from './admin';
import { lotNumber } from './ItemCard';
import { Button, cx, EmptyState, ErrorState, LinkButton, Pagination, Spinner, StatusBadge } from './ui';

const USERS_PAGE_SIZE = 15;
type Filter = 'all' | 'USER' | 'ADMIN' | 'blocked';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'USER', label: 'Members' },
  { key: 'ADMIN', label: 'Admins' },
  { key: 'blocked', label: 'Blocked' },
];

const columns = ['Member', 'Role', 'Joined', 'Listings', 'Bids', 'Status', ''];

const UserStatus = ({ blocked }: { blocked: boolean }) => <Pill tone={blocked ? 'danger' : 'live'}>{blocked ? 'Blocked' : 'Active'}</Pill>;

const SubHead = ({ children }: { children: string }) => <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">{children}</p>;

const DrawerBody = ({ user, confirmingBlock, onBlock, onCancelBlock }: { user: AdminUserDetail; confirmingBlock: boolean; onBlock: () => void; onCancelBlock: () => void }) => {
  const stats = [
    { label: 'Listings', value: user.counts.items },
    { label: 'Bids', value: user.counts.bids },
    { label: 'Watching', value: user.counts.watchlist },
  ];
  const rows = [
    {
      title: 'Recent listings',
      empty: 'No listings yet.',
      entries: user.recentItems.map(item => ({
        key: item.id,
        href: `/auctions/${item.id}`,
        label: `${lotNumber(item.id)} · ${item.title}`,
        trailing: <StatusBadge status={item.status} />,
      })),
    },
    {
      title: 'Recent bids',
      empty: 'No bids yet.',
      entries: user.recentBids.map(bid => ({ key: bid.id, href: `/auctions/${bid.itemId}`, label: bid.itemTitle, trailing: <span className="display tnum text-lg text-gold-300">{formatMoney(bid.amount)}</span> })),
    },
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={user.fullName} size="lg" blocked={user.isBlocked} />
        <div className="min-w-0">
          <p className="display truncate text-[28px] leading-[1.1]">{user.fullName}</p>
          <p className="mt-1 truncate text-[13px] text-muted">
            @{user.username} · {user.role === 'ADMIN' ? 'Admin' : 'Member'} · joined {formatMonthYear(user.createdAt)}
          </p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
      </div>
      <UserStatus blocked={user.isBlocked} />
      <div className="grid grid-cols-3 border-y border-line">
        {stats.map((stat, position) => (
          <div key={stat.label} className={position > 0 ? 'border-l border-line py-4 pl-3.5' : 'py-4 pl-0'}>
            <p className="display tnum text-[28px]">{stat.value}</p>
            <p className="mt-0.5 text-[11.5px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
      {rows.map(group => (
        <div key={group.title}>
          <SubHead>{group.title}</SubHead>
          {group.entries.length === 0 ? (
            <p className="py-2.5 text-[13.5px] text-muted">{group.empty}</p>
          ) : (
            group.entries.map(entry => (
              <Link key={entry.key} href={entry.href} className="flex items-center justify-between gap-3 border-b border-line-neutral py-2.5 text-[13.5px] text-text-2 transition hover:text-gold-300">
                <span className="truncate">{entry.label}</span>
                {entry.trailing}
              </Link>
            ))
          )}
        </div>
      ))}
      {confirmingBlock && (
        <div className="rise flex flex-col gap-3 border border-danger/35 bg-danger/5 p-[18px]">
          <p className="text-sm font-semibold text-danger">Block {user.fullName}?</p>
          <p className="text-[13px] leading-relaxed text-text-2">They will be signed out and unable to log in or bid until you unblock them.</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancelBlock}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={onBlock}>
              Block user
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const UserDrawer = ({ id, onClose }: { id: number; onClose: () => void }) => {
  const detail = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api.get<AdminUserDetail>(`/admin/users/${id}`) });
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const toggleBlock = useAdminMutation<boolean>(() => api.patch(`/admin/users/${id}/block`), blocking => (blocking ? 'User blocked.' : 'User unblocked.'));
  const remove = useAdminMutation(() => api.delete(`/admin/users/${id}`), 'User deleted.');
  const user = detail.data;
  const isMember = user?.role === 'USER';
  const deletable = isMember && user.counts.items === 0 && user.counts.bids === 0;

  const block = (blocking: boolean) => {
    setConfirmingBlock(false);
    toggleBlock.mutate(blocking);
  };

  return (
    <Drawer
      title={`User · #${id}`}
      onClose={onClose}
      footer={
        user && (
          <>
            <LinkButton href={`mailto:${user.email}`} variant="secondary" className="flex-1">
              Message
            </LinkButton>
            {isMember && (
              <Button variant={user.isBlocked ? 'secondary' : 'danger'} className="flex-1" disabled={toggleBlock.isPending} onClick={() => (user.isBlocked ? block(false) : setConfirmingBlock(true))}>
                {user.isBlocked ? 'Unblock' : 'Block'}
              </Button>
            )}
          </>
        )
      }
    >
      {detail.isPending && <Spinner />}
      {detail.isError && <ErrorState message={detail.error.message} />}
      {user && (
        <>
          <DrawerBody user={user} confirmingBlock={confirmingBlock} onBlock={() => block(true)} onCancelBlock={() => setConfirmingBlock(false)} />
          {deletable && <ConfirmButton label="Delete account" prompt="Delete permanently?" confirmLabel="Delete" disabled={remove.isPending} onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}
        </>
      )}
    </Drawer>
  );
};

export const Users = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useDebounced(search);
  const users = useQuery({
    queryKey: ['admin', 'users', q, filter, page],
    queryFn: () =>
      api.page<AdminUser>(withQuery('/admin/users', { q, page, pageSize: USERS_PAGE_SIZE, role: filter === 'USER' || filter === 'ADMIN' ? filter : undefined, blocked: filter === 'blocked' ? 'true' : undefined })),
    placeholderData: previous => previous,
  });

  return (
    <div className="flex flex-col gap-7">
      <AdminTitle eyebrow="Members" title="Users" action={<span className="text-[13px] text-muted">{users.data ? `${users.data.meta.total} accounts` : ''}</span>} />
      <div className="flex flex-wrap items-center gap-4">
        <SearchBox
          value={search}
          onChange={value => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name, @username or email"
        />
        <FilterChips
          options={filters}
          value={filter}
          onChange={key => {
            setFilter(key);
            setPage(1);
          }}
        />
      </div>
      <Async query={users}>
        {({ items, meta }) =>
          items.length === 0 ? (
            <EmptyState title="No members found" hint={q ? `Nothing matches “${q}”.` : undefined} />
          ) : (
            <>
              <div className="overflow-x-auto border-t border-line-strong">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr>
                      {columns.map((heading, position) => (
                        <th key={position} className={thClass}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(user => (
                      <tr key={user.id} onClick={() => setOpenId(user.id)} className={cx('cursor-pointer transition hover:bg-gold-300/[0.04]', openId === user.id && 'bg-gold-300/5')}>
                        <td className={tdClass}>
                          <button type="button" className="flex items-center gap-3 text-left">
                            <Avatar name={user.fullName} blocked={user.isBlocked} />
                            <span>
                              <span className={cx('block font-medium', user.isBlocked && 'text-muted')}>{user.fullName}</span>
                              <span className="block text-xs text-muted">
                                @{user.username} · #{user.id}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className={cx(tdClass, 'text-text-2')}>{user.role === 'ADMIN' ? 'Admin' : 'Member'}</td>
                        <td className={cx(tdClass, 'text-muted')}>{formatMonthYear(user.createdAt)}</td>
                        <td className={cx(tdClass, 'tnum')}>{user.itemCount}</td>
                        <td className={cx(tdClass, 'tnum')}>{user.bidCount}</td>
                        <td className={tdClass}>
                          <UserStatus blocked={user.isBlocked} />
                        </td>
                        <td className={cx(tdClass, 'text-right text-muted')}>
                          <Icon name="next" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onChange={setPage} />
            </>
          )
        }
      </Async>
      {openId !== null && <UserDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
};
