'use client';

import Link from 'next/link';
import { type Urgency, formatMoney, formatTimeLeft, plural, urgencyOf } from '../lib/format';
import { useNow } from '../lib/hooks';
import type { ListItem } from '../lib/types';
import { cx, Skeleton, StatusBadge } from './ui';

const urgencyColor: Record<Urgency, string> = { normal: 'text-text', urgent: 'text-outbid', critical: 'text-danger' };

export const Countdown = ({ endDate, className }: { endDate: string; className?: string }) => {
  const now = useNow();
  return (
    <span className={cx('tnum', urgencyColor[urgencyOf(endDate, now)], className)} suppressHydrationWarning>
      {formatTimeLeft(endDate, now)}
    </span>
  );
};

const EndingBadge = ({ endDate }: { endDate: string }) => {
  const now = useNow();
  if (urgencyOf(endDate, now) === 'normal') return null;
  return (
    <span className="tnum absolute bottom-3 left-3 inline-flex h-[26px] items-center gap-2 rounded-full bg-ink/80 px-3 text-[11px] font-semibold tracking-[0.12em] text-outbid uppercase backdrop-blur" suppressHydrationWarning>
      <span className="live-dot size-1.5 rounded-full bg-current" />
      {formatTimeLeft(endDate, now)}
    </span>
  );
};

export const lotNumber = (id: number) => `Lot ${String(id).padStart(3, '0')}`;

export const ItemCard = ({ item }: { item: ListItem }) => (
  <Link href={`/auctions/${item.id}`} className="group rise flex flex-col gap-4 text-text">
    <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface-2 transition group-hover:border-line-strong">
      {item.primaryImage ? (
        <img src={item.primaryImage} alt={item.title} loading="lazy" className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:scale-105" />
      ) : (
        <div className="flex size-full items-center justify-center text-sm text-muted">No image</div>
      )}
      <span className="absolute top-3 left-3 bg-ink/70 px-2 py-1 text-[10.5px] font-semibold tracking-[0.22em] text-gold-300 uppercase backdrop-blur">{lotNumber(item.id)}</span>
      {item.featured && <span className="absolute top-3 right-3 bg-gold-300 px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-ink uppercase">Featured</span>}
      {item.status === 'active' ? (
        <EndingBadge endDate={item.endDate} />
      ) : (
        <span className="absolute bottom-3 left-3">
          <StatusBadge status={item.status} />
        </span>
      )}
    </div>
    <div className="flex flex-col gap-2">
      <p className="eyebrow text-muted!">{item.category?.name ?? 'Uncategorised'}</p>
      <h3 className="display line-clamp-2 text-2xl leading-[1.15] transition group-hover:text-gold-300">{item.title}</h3>
      {item.seller && <p className="text-xs text-muted">{item.seller.username}</p>}
    </div>
    <div className="flex items-end justify-between border-t border-line pt-3 transition group-hover:border-line-strong">
      <div>
        <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">{item.hasBids ? 'Current bid' : 'Opening bid'}</p>
        <p className="display gold-text tnum text-2xl">{formatMoney(item.currentPrice)}</p>
      </div>
      <div className="tnum text-right text-xs text-muted">
        <p>{plural(item.bidCount, 'bid')}</p>
        {item.status === 'active' && <Countdown endDate={item.endDate} className="mt-0.5 block" />}
      </div>
    </div>
  </Link>
);

export const ItemCardSkeleton = () => (
  <div aria-busy className="flex flex-col gap-4">
    <Skeleton className="aspect-[4/5]" />
    <div className="space-y-2">
      <Skeleton className="h-2.5 w-[30%]" />
      <Skeleton className="h-5 w-[85%]" />
      <Skeleton className="h-5 w-[55%]" />
    </div>
    <div className="flex justify-between border-t border-line pt-3">
      <Skeleton className="h-6 w-[40%]" />
      <Skeleton className="h-6 w-[22%]" />
    </div>
  </div>
);
