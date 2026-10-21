'use client';

import Link from 'next/link';
import { formatMoney } from '../lib/format';
import type { ListItem } from '../lib/types';
import { Countdown, lotNumber } from './ItemCard';

const FeatureCard = ({ item }: { item: ListItem }) => (
  <Link href={`/auctions/${item.id}`} className="group relative block aspect-[16/11] overflow-hidden bg-surface-2 text-text">
    {item.primaryImage && <img src={item.primaryImage} alt={item.title} className="size-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-expo)] group-hover:scale-105" />}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 via-40% to-transparent to-65%" />
    {item.featured && <span className="absolute top-5 left-5 inline-flex h-[26px] items-center rounded-full bg-gold-300 px-3 text-[10.5px] font-bold tracking-[0.16em] text-ink uppercase">Featured</span>}
    <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-6 sm:right-8 sm:bottom-7 sm:left-8">
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="eyebrow">
          {lotNumber(item.id)} · {item.category?.name ?? 'Uncategorised'}
        </p>
        <h3 className="display text-3xl text-balance sm:text-[44px] sm:leading-[1.04]">{item.title}</h3>
      </div>
      <div className="shrink-0 text-right">
        <p className="mb-1 text-[10px] tracking-[0.2em] text-text-2 uppercase">
          {item.bidCount} bids · <Countdown endDate={item.endDate} className="font-semibold" />
        </p>
        <p className="display gold-text tnum text-4xl sm:text-[56px] sm:leading-none">{formatMoney(item.currentPrice)}</p>
      </div>
    </div>
  </Link>
);

const RailRow = ({ item }: { item: ListItem }) => (
  <Link href={`/auctions/${item.id}`} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-line py-4 transition hover:bg-gold-300/3">
    <div className="size-24 overflow-hidden bg-surface-2">{item.primaryImage && <img src={item.primaryImage} alt="" loading="lazy" className="size-full object-cover" />}</div>
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="truncate text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">
        {lotNumber(item.id)} · {item.category?.name ?? 'Uncategorised'}
      </p>
      <p className="display line-clamp-2 text-[21px] leading-[1.15]">{item.title}</p>
      <Countdown endDate={item.endDate} className="text-[12.5px] font-semibold" />
    </div>
    <p className="display tnum text-2xl text-gold-300">{formatMoney(item.currentPrice)}</p>
  </Link>
);

export const AuctionEndingRail = ({ items, onSeeAll }: { items: ListItem[]; onSeeAll: () => void }) => {
  const [feature, ...rest] = items;
  if (!feature) return null;

  return (
    <section className="mb-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-2.5 text-outbid!">Closing tonight</p>
          <h2 className="display text-4xl md:text-[44px]">Ending soon</h2>
        </div>
        <button onClick={onSeeAll} className="text-sm text-text-2 transition hover:text-gold-300">
          All ending today →
        </button>
      </div>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <FeatureCard item={feature} />
        <div className="flex flex-col border-t border-line-strong">
          {rest.map(item => (
            <RailRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};
