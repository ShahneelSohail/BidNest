'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api, withQuery } from '../lib/api';
import type { AdminBid } from '../lib/admin';
import { formatMoney } from '../lib/format';
import { useDebounced } from '../lib/hooks';
import { Ago, Async, AdminTitle, BidsChart, Pill, SearchBox, SectionHead, tdClass, thClass, useAdminOverview } from './admin';
import { lotNumber } from './ItemCard';
import { Button, cx, EmptyState, Pagination, StatusBadge } from './ui';

const BIDS_PAGE_SIZE = 20;
const LIVE_REFRESH_MS = 5000;
const HOT_LOTS = 4;

const columns = ['Time', 'Lot', 'Bidder', 'Amount', 'Bid', 'Lot status'];

const hottestLots = (bids: AdminBid[]) => {
  const lots = new Map<number, { id: number; title: string; count: number }>();
  bids.forEach(bid => lots.set(bid.itemId, { id: bid.itemId, title: bid.itemTitle, count: (lots.get(bid.itemId)?.count ?? 0) + 1 }));
  return [...lots.values()].sort((a, b) => b.count - a.count).slice(0, HOT_LOTS);
};

export const BidsMonitor = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paused, setPaused] = useState(false);
  const q = useDebounced(search);
  const live = !paused && page === 1;
  const bids = useQuery({
    queryKey: ['admin', 'bids', q, page],
    queryFn: () => api.page<AdminBid>(withQuery('/admin/bids', { q, page, pageSize: BIDS_PAGE_SIZE })),
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    placeholderData: previous => previous,
  });
  const overview = useAdminOverview();

  return (
    <div className="flex flex-col gap-8">
      <AdminTitle
        eyebrow={
          <span className={cx('inline-flex items-center gap-2', live ? 'text-live!' : 'text-muted!')}>
            <span className={cx('size-[7px] rounded-full bg-current', live && 'live-dot')} />
            {live ? 'Live' : 'Paused'} · every bid, as it lands
          </span>
        }
        title="Bids monitor"
        action={
          <Button variant="secondary" onClick={() => setPaused(current => !current)}>
            {paused ? 'Resume stream' : 'Pause stream'}
          </Button>
        }
      />
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SearchBox
            value={search}
            onChange={value => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Lot title or bidder"
          />
          <Async query={bids}>
            {({ items, meta }) =>
              items.length === 0 ? (
                <EmptyState title="No bids found" />
              ) : (
                <>
                  <div className="overflow-x-auto border-t border-line-strong">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr>
                          {columns.map(heading => (
                            <th key={heading} className={cx(thClass, heading === 'Amount' && 'text-right')}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(bid => (
                          <tr key={bid.id}>
                            <td className={cx(tdClass, 'tnum text-[12.5px] whitespace-nowrap text-muted')}>
                              <Ago at={bid.bidTime} />
                            </td>
                            <td className={tdClass}>
                              <Link href={`/auctions/${bid.itemId}`} className="group">
                                <span className="text-[10.5px] font-semibold tracking-[0.16em] text-gold-300 uppercase">{lotNumber(bid.itemId)}</span> <span className="text-[13px] text-text-2 transition group-hover:text-gold-300">{bid.itemTitle}</span>
                              </Link>
                            </td>
                            <td className={tdClass}>@{bid.bidderName}</td>
                            <td className={cx(tdClass, 'display tnum text-right text-[19px] text-gold-300')}>{formatMoney(bid.amount)}</td>
                            <td className={tdClass}>
                              <Pill tone={bid.isWinning ? 'gold' : 'neutral'}>{bid.isWinning ? 'Leading' : 'Outbid'}</Pill>
                            </td>
                            <td className={tdClass}>
                              <StatusBadge status={bid.itemStatus} />
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
        </div>
        <aside className="top-6 flex flex-col gap-10 xl:sticky">
          <div>
            <SectionHead title="Bids per hour" />
            <div className="mt-4">
              <Async query={overview}>{({ bidsPerHour }) => <BidsChart values={bidsPerHour} />}</Async>
            </div>
          </div>
          {bids.data && bids.data.items.length > 0 && (
            <div>
              <p className="border-b border-line-strong pb-2.5 text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">Most active on this page</p>
              {hottestLots(bids.data.items).map(lot => (
                <Link key={lot.id} href={`/auctions/${lot.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-neutral py-3 transition hover:text-gold-300">
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-semibold tracking-[0.16em] text-gold-300 uppercase">{lotNumber(lot.id)}</span>
                    <span className="block truncate text-[13px] text-text-2">{lot.title}</span>
                  </span>
                  <span className="display tnum text-xl">{lot.count}</span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
