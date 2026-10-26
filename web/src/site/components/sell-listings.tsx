'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { api, withQuery } from '../lib/api';
import { formatMoney } from '../lib/format';
import { formatDate, invalidateSeller, statusFilters, statusLabels, type SellerItem, type StatusFilter } from '../lib/seller';
import type { ItemStatus } from '../lib/types';
import { Countdown, lotNumber } from './ItemCard';
import { useToast } from './Providers';
import { ConfirmDialog } from './sell-dialog';
import { Icon, type IconName } from './sell-icons';
import { cx, EmptyState, ErrorState, Pagination, Skeleton, StatusBadge, Tabs } from './ui';

type ActionKey = 'view' | 'feedback' | 'extend' | 'relist' | 'edit' | 'end' | 'delete';
type Dialog = 'end' | 'delete';

interface ListingAction {
  label: string;
  icon: IconName;
  href?: string;
  run?: () => void;
  danger?: boolean;
  separated?: boolean;
  lockedHint?: string;
}

const menuKeys: Record<ItemStatus, ActionKey[]> = {
  active: ['view', 'extend', 'edit', 'end', 'delete'],
  draft: ['edit', 'delete'],
  pending: ['view', 'edit', 'delete'],
  rejected: ['feedback', 'delete'],
  sold: ['view'],
  expired: ['relist', 'edit', 'delete'],
};

const primaryKey: Record<ItemStatus, ActionKey> = { draft: 'edit', active: 'extend', pending: 'edit', rejected: 'feedback', sold: 'view', expired: 'relist' };
const primaryLabel: Record<ItemStatus, string> = { draft: 'Continue', active: 'Extend', pending: 'Edit', rejected: 'View feedback', sold: 'View', expired: 'Relist' };

const menuItemClass = (action: ListingAction) =>
  cx(
    'flex min-h-12 w-full items-start gap-3 rounded-xs px-2.5 py-2 text-left text-[15px] transition md:min-h-10 md:text-sm',
    action.lockedHint ? 'cursor-not-allowed text-muted/70' : action.danger ? 'text-danger hover:bg-surface-3' : 'text-text hover:bg-surface-3'
  );

const MenuItem = ({ action, onDone }: { action: ListingAction; onDone: () => void }) => {
  const body = (
    <>
      <Icon name={action.icon} className="mt-px shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span>{action.label}</span>
        {action.lockedHint && <span className="text-[11.5px] text-muted">{action.lockedHint}</span>}
      </span>
    </>
  );
  return (
    <>
      {action.separated && <div className="my-1.5 hidden h-px bg-line md:block" />}
      {action.href && !action.lockedHint ? (
        <Link href={action.href} role="menuitem" className={menuItemClass(action)} onClick={onDone}>
          {body}
        </Link>
      ) : (
        <button
          type="button"
          role="menuitem"
          disabled={!!action.lockedHint}
          className={menuItemClass(action)}
          onClick={() => {
            onDone();
            action.run?.();
          }}
        >
          {body}
        </button>
      )}
    </>
  );
};

const RowActions = ({ item, compact }: { item: SellerItem; compact?: boolean }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const settle = (message: string) => {
    toast('success', message);
    setDialog(null);
    return invalidateSeller(queryClient);
  };
  const extend = useMutation({
    mutationFn: (hours: number) => api.post(`/seller/items/${item.id}/extend`, { hours }),
    onSuccess: (_data, hours) => settle(hours === 24 ? 'Auction extended by 24 hours.' : 'Listing relisted for 7 days.'),
    onError: error => toast('error', error.message),
  });
  const end = useMutation({
    mutationFn: () => api.post(`/seller/items/${item.id}/expire`),
    onSuccess: () => settle(item.hasBids ? 'Lot closed and sold to the highest bidder.' : 'Auction ended.'),
    onError: error => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/seller/items/${item.id}`),
    onSuccess: () => settle('Listing deleted.'),
    onError: error => toast('error', error.message),
  });

  const actions: Record<ActionKey, ListingAction> = {
    view: { label: 'View listing', icon: 'eye', href: `/auctions/${item.id}` },
    feedback: { label: 'View feedback', icon: 'flag', href: `/sell/${item.id}` },
    extend: { label: 'Extend 24 hours', icon: 'clock', run: () => extend.mutate(24) },
    relist: { label: 'Relist for 7 days', icon: 'redo', run: () => extend.mutate(168) },
    edit: { label: 'Edit listing', icon: 'edit', href: `/sell/${item.id}/edit`, lockedHint: item.status === 'pending' || item.status === 'draft' ? undefined : 'Only drafts and listings awaiting approval can be edited' },
    end: { label: item.hasBids ? 'End now and sell' : 'End early', icon: 'stop', danger: true, separated: true, run: () => setDialog('end') },
    delete: { label: item.status === 'pending' ? 'Withdraw and delete' : item.status === 'draft' ? 'Discard draft' : 'Delete', icon: 'trash', danger: true, separated: true, lockedHint: item.hasBids ? 'Lots with bids can’t be deleted' : undefined, run: () => setDialog('delete') },
  };
  const primary = actions[primaryKey[item.status]];
  const primaryClass = cx(
    'inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition hover:bg-gold-300/10 disabled:cursor-not-allowed disabled:opacity-45',
    item.status === 'rejected' ? 'border-danger/45 text-danger' : 'border-line-strong text-text'
  );

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {!compact &&
        (primary.href ? (
          <Link href={primary.href} className={primaryClass}>
            {primaryLabel[item.status]}
          </Link>
        ) : (
          <button type="button" disabled={extend.isPending} onClick={primary.run} className={primaryClass}>
            {primaryLabel[item.status]}
          </button>
        ))}
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={cx('grid place-items-center rounded-full text-text-2 transition hover:bg-surface-3 hover:text-text', compact ? 'size-11' : 'size-9', open && 'bg-surface-3')}
      >
        <Icon name="more" size={18} strokeWidth={3} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:bg-transparent" />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-md border-t border-line-strong bg-surface-2 px-4 pt-3 pb-8 text-left shadow-e3 md:absolute md:inset-x-auto md:top-11 md:right-0 md:bottom-auto md:w-[250px] md:rounded-sm md:border md:border-line md:bg-surface-3 md:p-1.5"
          >
            <span aria-hidden className="mb-3 h-1 w-9 self-center rounded-full bg-white/20 md:hidden" />
            <p className="eyebrow mx-1 mb-1 md:hidden">{lotNumber(item.id)}</p>
            <p className="display mx-1 mb-3 text-[22px] md:hidden">{item.title}</p>
            {menuKeys[item.status].map(key => (
              <MenuItem key={key} action={actions[key]} onDone={() => setOpen(false)} />
            ))}
          </div>
        </>
      )}
      {dialog === 'end' && (
        <ConfirmDialog
          eyebrow={`${lotNumber(item.id)} · ${item.title}`}
          title={item.hasBids ? 'End now and sell?' : 'End this auction early?'}
          cancelLabel="Keep it running"
          confirmLabel={item.hasBids ? `Sell at ${formatMoney(item.currentPrice)}` : 'End auction'}
          pending={end.isPending}
          onConfirm={() => end.mutate()}
          onClose={() => setDialog(null)}
        >
          {item.hasBids ? `The lot closes now and sells to the highest bidder at ${formatMoney(item.currentPrice)}. This can’t be undone.` : 'The lot closes now with no winner and moves to Unsold.'}
        </ConfirmDialog>
      )}
      {dialog === 'delete' && (
        <ConfirmDialog eyebrow={lotNumber(item.id)} title="Delete this listing?" confirmLabel="Delete listing" pending={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setDialog(null)}>
          “{item.title}” and its photos will be permanently removed.
        </ConfirmDialog>
      )}
    </div>
  );
};

const statusNote = (item: SellerItem): ReactNode => {
  if (item.status === 'active') return <Countdown endDate={item.endDate} />;
  const notes: Record<Exclude<ItemStatus, 'active'>, string> = { draft: 'Not submitted', pending: 'Awaiting review', rejected: 'Sent back', sold: `Sold ${formatDate(item.endDate)}`, expired: `Ended ${formatDate(item.endDate)}` };
  return <span className={item.status === 'rejected' ? 'text-danger' : 'text-muted'}>{notes[item.status]}</span>;
};

const Thumb = ({ item, size }: { item: SellerItem; size: string }) =>
  item.primaryImage ? (
    <img src={item.primaryImage} alt="" className={cx(size, 'shrink-0 object-cover', item.status === 'expired' && 'opacity-50')} />
  ) : (
    <span className={cx(size, 'grid shrink-0 place-items-center border border-dashed border-line-strong text-muted')}>
      <Icon name="image" size={18} />
    </span>
  );

const priceLabelOf = (item: SellerItem) => (item.status === 'sold' ? 'Hammer' : item.hasBids ? 'Current' : 'Opening');
const priceColorOf = (item: SellerItem) => (item.status === 'active' || item.status === 'sold' ? 'text-gold-300' : 'text-text-2');
const hasBidData = (item: SellerItem) => item.status !== 'draft' && item.status !== 'pending' && item.status !== 'rejected';

const columns = [
  { label: 'Lot', align: 'text-left' },
  { label: 'Status', align: 'text-left' },
  { label: 'Bids', align: 'text-right' },
  { label: 'Price', align: 'text-right' },
  { label: 'Time left', align: 'text-right' },
  { label: 'Views · watchers', align: 'text-right' },
  { label: '', align: 'text-right' },
];

const cell = 'border-b border-line-neutral px-3';

const TableRow = ({ item, index }: { item: SellerItem; index: number }) => (
  <tr className="rise transition hover:bg-gold-300/[0.03]" style={{ animationDelay: `${index * 40}ms` }}>
    <td className={cx(cell, 'py-3.5')}>
      <div className="flex items-center gap-4">
        <Thumb item={item} size="size-14" />
        <div className="min-w-0">
          <p className="display text-[19px] leading-[1.2]">{item.title}</p>
          <p className="mt-[3px] text-xs text-muted">
            {lotNumber(item.id)} · {item.category?.name ?? 'Uncategorised'}
          </p>
        </div>
      </div>
    </td>
    <td className={cell}>
      <StatusBadge status={item.status} label={statusLabels[item.status]} />
    </td>
    <td className={cx(cell, 'tnum text-right text-text-2')}>{hasBidData(item) ? item.bidCount : '—'}</td>
    <td className={cx(cell, 'text-right')}>
      <p className={cx('display text-xl', priceColorOf(item))}>{formatMoney(item.currentPrice)}</p>
      <p className="mt-px text-[10.5px] tracking-[0.12em] text-muted uppercase">{priceLabelOf(item)}</p>
    </td>
    <td className={cx(cell, 'tnum text-right whitespace-nowrap')}>{statusNote(item)}</td>
    <td className={cx(cell, 'tnum text-right whitespace-nowrap text-muted')}>{item.viewCount ? `${item.viewCount.toLocaleString('en-US')} · ${item.watcherCount}` : '—'}</td>
    <td className={cx(cell, 'w-[200px] text-right')}>
      <RowActions item={item} />
    </td>
  </tr>
);

const MobileRow = ({ item }: { item: SellerItem }) => (
  <li className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-center gap-3 border-b border-line py-3.5">
    <Thumb item={item} size="size-16" />
    <div className="flex min-w-0 flex-col gap-1">
      <span className="self-start">
        <StatusBadge status={item.status} label={statusLabels[item.status]} />
      </span>
      <Link href={item.status === 'rejected' ? `/sell/${item.id}` : `/auctions/${item.id}`} className="display truncate text-[17px] leading-[1.15]">
        {item.title}
      </Link>
      <p className="tnum text-xs text-muted">
        <span className={priceColorOf(item)}>{formatMoney(item.currentPrice)}</span> · {statusNote(item)}
      </p>
    </div>
    <RowActions item={item} compact />
  </li>
);

const ListingsSkeleton = () => (
  <div className="space-y-3" aria-busy>
    {Array.from({ length: 4 }, (_, index) => (
      <Skeleton key={index} className="h-[84px]" />
    ))}
  </div>
);

export const ListingsTable = ({ status, counts, onStatusChange }: { status: StatusFilter; counts?: Record<StatusFilter, number>; onStatusChange: (status: StatusFilter) => void }) => {
  const [page, setPage] = useState(1);
  const items = useQuery({ queryKey: ['seller', 'items', status, page], queryFn: () => api.page<SellerItem>(withQuery('/seller/items', { status, page })) });

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="display text-4xl md:text-[44px]">Listings</h2>
        {items.data && <span className="text-[13px] text-muted">{items.data.meta.total} shown</span>}
      </div>
      <Tabs
        tabs={statusFilters.map(key => ({ key, label: statusLabels[key], count: counts?.[key] }))}
        value={status}
        onChange={key => {
          onStatusChange(key);
          setPage(1);
        }}
      />
      {items.isPending && <ListingsSkeleton />}
      {items.error && <ErrorState message={items.error.message} />}
      {items.data &&
        (items.data.items.length === 0 ? (
          <EmptyState title={`No ${statusLabels[status].toLowerCase()} listings`} hint={status === 'rejected' ? 'Nothing has been sent back.' : 'Listings with this status will appear here.'} />
        ) : (
          <>
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr>
                  {columns.map(column => (
                    <th key={column.label} className={cx('h-11 border-b border-line px-3 text-[10.5px] font-semibold tracking-[0.18em] whitespace-nowrap text-muted uppercase', column.align)}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.data.items.map((item, index) => (
                  <TableRow key={item.id} item={item} index={index} />
                ))}
              </tbody>
            </table>
            <ul className="md:hidden">
              {items.data.items.map(item => (
                <MobileRow key={item.id} item={item} />
              ))}
            </ul>
            <Pagination meta={items.data.meta} onChange={setPage} />
          </>
        ))}
    </section>
  );
};
