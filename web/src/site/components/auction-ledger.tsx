'use client';

import { useRef } from 'react';
import { formatMoney } from '../lib/format';
import { useNow } from '../lib/hooks';
import type { Bid } from '../lib/types';
import { cx } from './ui';

const initialsOf = (name: string) => name.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();

const timeAgo = (value: string, now: number) => {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

export const AuctionLedger = ({ bids, bidCount, userId, isLive }: { bids: Bid[]; bidCount: number; userId: number | undefined; isLive: boolean }) => {
  const now = useNow();
  const initialIds = useRef(new Set(bids.map(bid => bid.id)));

  return (
    <div className="flex flex-col gap-1 pt-4">
      <div className="flex items-baseline justify-between border-b border-line-strong pb-3.5">
        <h2 className="display text-3xl">Bid ledger</h2>
        <span className="text-[13px] text-muted tnum">{bidCount} bids</span>
      </div>
      {bids.length === 0 ? (
        <div className="flex flex-col items-center gap-3.5 py-10 text-center">
          <div className="gavel-mask h-[72px] w-24 opacity-80" />
          <p className="display text-[22px]">No bids yet</p>
          <p className="max-w-[280px] text-[13px] text-muted">{isLive ? 'Be the first to bid and set the pace for this lot.' : 'This lot closed without any bids.'}</p>
        </div>
      ) : (
        <ul>
          {bids.map((bid, index) => {
            const mine = bid.bidderId === userId;
            return (
              <li key={bid.id} className={cx('-mx-2.5 grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-white/6 px-2.5 py-3.5', mine && 'bg-gold-300/6', !initialIds.current.has(bid.id) && 'rise')}>
                <span className={cx('grid size-9 place-items-center rounded-full border text-xs font-semibold', mine ? 'border-gold-300/45 bg-gold-900 text-gold-300' : 'border-line-neutral bg-surface-3 text-text-2')}>{mine ? 'YOU' : initialsOf(bid.bidderName)}</span>
                <div className="min-w-0">
                  <p className={cx('flex items-center gap-2 text-sm', mine ? 'font-semibold text-gold-300' : 'text-text')}>
                    {mine ? 'You' : bid.bidderName}
                    {index === 0 && isLive && <span className="rounded-full bg-gold-300/12 px-[7px] py-0.5 text-[9.5px] font-semibold tracking-[0.16em] text-gold-300 uppercase">Leading</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted" suppressHydrationWarning>
                    {timeAgo(bid.bidTime, now)}
                  </p>
                </div>
                <span className={cx('display text-[22px] tnum', index === 0 ? 'text-gold-300' : 'text-text-2')}>{formatMoney(bid.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
