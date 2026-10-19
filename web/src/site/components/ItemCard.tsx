'use client';

import Link from 'next/link';
import { useNow } from '../lib/hooks';
import { formatMoney, formatTimeLeft } from '../lib/format';
import type { ListItem } from '../lib/types';
import { StatusBadge } from './ui';

export const Countdown = ({ endDate, className }: { endDate: string; className?: string }) => {
  const now = useNow();
  return <span className={className}>{formatTimeLeft(endDate, now)}</span>;
};

export const ItemCard = ({ item }: { item: ListItem }) => (
  <Link href={`/auctions/${item.id}`} className="group overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-white/30">
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      {item.primaryImage ? (
        <img src={item.primaryImage} alt={item.title} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className="flex size-full items-center justify-center text-sm text-muted">No image</div>
      )}
      {item.featured && <span className="absolute top-3 left-3 rounded-full bg-yellow px-2.5 py-0.5 text-xs font-semibold text-black">Featured</span>}
    </div>
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 font-medium">{item.title}</h3>
        {item.status !== 'active' && <StatusBadge status={item.status} />}
      </div>
      <p className="text-xs text-muted">{item.category?.name ?? 'Uncategorised'}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted">{item.hasBids ? 'Current bid' : 'Starting bid'}</p>
          <p className="text-lg font-semibold text-yellow">{formatMoney(item.currentPrice)}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>{item.bidCount} bids</p>
          {item.status === 'active' && <Countdown endDate={item.endDate} />}
        </div>
      </div>
    </div>
  </Link>
);
