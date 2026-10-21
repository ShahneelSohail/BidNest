'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api, withQuery } from '../lib/api';
import type { AdminItem } from '../lib/admin';
import { formatDateTime, formatMoney } from '../lib/format';
import { useDebounced } from '../lib/hooks';
import { Async, AdminTitle, ConfirmButton, FilterChips, Icon, SearchBox, tdClass, thClass, useAdminMutation } from './admin';
import { Countdown, lotNumber } from './ItemCard';
import { Button, cx, EmptyState, Pagination, StatusBadge } from './ui';

const LISTINGS_PAGE_SIZE = 15;
const EXTEND_DAYS = [1, 3, 7, 14];
const STATUSES = [
  { key: 'ACTIVE', label: 'Live' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'SOLD', label: 'Sold' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;
type Filter = 'all' | (typeof STATUSES)[number]['key'];

const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'All' }, ...STATUSES];
const columns = ['', 'Lot', 'Seller', 'Status', 'Bids', 'Price', 'Ends', ''];
const numericColumns = ['Bids', 'Price', 'Ends'];

const ExtendControl = ({ onExtend, disabled }: { onExtend: (days: number) => void; disabled: boolean }) => {
  const [open, setOpen] = useState(false);
  return open ? (
    <span className="inline-flex items-center gap-1.5">
      {EXTEND_DAYS.map(days => (
        <Button
          key={days}
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            onExtend(days);
          }}
        >
          +{days}d
        </Button>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
      Extend
    </Button>
  );
};

const ListingRow = ({ item }: { item: AdminItem }) => {
  const feature = useAdminMutation(() => api.patch(`/admin/items/${item.id}/featured`), item.featured ? 'Removed from featured.' : 'Lot featured.');
  const changeStatus = useAdminMutation((status: string) => api.patch(`/admin/items/${item.id}/status`, { status }), 'Status updated.');
  const extend = useAdminMutation((days: number) => api.post(`/admin/items/${item.id}/extend`, { days }), days => `Auction extended by ${days} day${days === 1 ? '' : 's'}.`);
  const remove = useAdminMutation(() => api.delete(`/admin/items/${item.id}`), 'Listing deleted.');

  return (
    <tr className="transition hover:bg-gold-300/[0.03]">
      <td className="w-11 border-b border-line-neutral text-center">
        <button
          onClick={() => feature.mutate()}
          disabled={feature.isPending}
          aria-label={item.featured ? 'Remove from featured' : 'Feature this lot'}
          aria-pressed={item.featured}
          className={cx('grid size-10 place-items-center transition hover:scale-115', item.featured ? 'text-gold-300' : 'text-muted')}
        >
          <Icon name="star" size={17} filled={item.featured} />
        </button>
      </td>
      <td className={tdClass}>
        <Link href={`/auctions/${item.id}`} className="group flex items-center gap-3.5">
          {item.primaryImage ? <img src={item.primaryImage} alt="" className="size-12 shrink-0 object-cover" /> : <span className="size-12 shrink-0 bg-surface-2" />}
          <span className="min-w-0">
            <span className="display block max-w-64 truncate text-lg leading-tight transition group-hover:text-gold-300">{item.title}</span>
            <span className="block text-xs text-muted">{lotNumber(item.id)}</span>
          </span>
        </Link>
      </td>
      <td className={cx(tdClass, 'text-text-2')}>@{item.seller.username}</td>
      <td className={tdClass}>
        <StatusBadge status={item.status} />
      </td>
      <td className={cx(tdClass, 'tnum text-right')}>{item.bidCount}</td>
      <td className={cx(tdClass, 'display tnum text-right text-lg text-gold-300')}>{formatMoney(item.currentPrice)}</td>
      <td className={cx(tdClass, 'tnum text-right text-text-2')}>{item.status === 'active' ? <Countdown endDate={item.endDate} /> : formatDateTime(item.endDate)}</td>
      <td className={tdClass}>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {(item.status === 'active' || item.status === 'expired') && <ExtendControl disabled={extend.isPending} onExtend={days => extend.mutate(days)} />}
          <select
            aria-label={`Change status of ${item.title}`}
            value={item.status.toUpperCase()}
            disabled={changeStatus.isPending}
            onChange={event => changeStatus.mutate(event.target.value)}
            className="h-9 rounded-full border border-line-strong bg-ink px-3 text-[12.5px] text-text outline-none transition focus:border-gold-300"
          >
            {STATUSES.map(status => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>
          <ConfirmButton label="Remove" prompt={item.bidCount > 0 ? `Delete with ${item.bidCount} bids?` : 'Delete listing?'} confirmLabel="Delete" disabled={remove.isPending} onConfirm={() => remove.mutate()} />
        </div>
      </td>
    </tr>
  );
};

export const Listings = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const listings = useQuery({
    queryKey: ['admin', 'items', q, filter, page],
    queryFn: () => api.page<AdminItem>(withQuery('/admin/items', { q, status: filter, page, pageSize: LISTINGS_PAGE_SIZE })),
    placeholderData: previous => previous,
  });

  return (
    <div className="flex flex-col gap-7">
      <AdminTitle eyebrow="Catalogue" title="Listings" action={<span className="text-[13px] text-muted">{listings.data ? `${listings.data.meta.total} lots` : ''}</span>} />
      <div className="flex flex-wrap items-center gap-4">
        <SearchBox
          value={search}
          onChange={value => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Title or seller"
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
      <Async query={listings}>
        {({ items, meta }) =>
          items.length === 0 ? (
            <EmptyState title="No listings match these filters" />
          ) : (
            <>
              <div className="overflow-x-auto border-t border-line-strong">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr>
                      {columns.map((heading, position) => (
                        <th key={position} className={cx(thClass, numericColumns.includes(heading) && 'text-right')}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <ListingRow key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onChange={setPage} />
            </>
          )
        }
      </Async>
    </div>
  );
};
