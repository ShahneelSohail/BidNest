import Link from 'next/link';
import { formatMoney, plural } from '../lib/format';
import type { ListItem } from '../lib/types';
import { Countdown, lotNumber } from './ItemCard';
import { StatusBadge } from './ui';

export const AuctionListRow = ({ item }: { item: ListItem }) => (
  <Link href={`/auctions/${item.id}`} className="group rise grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-b border-line py-[18px] sm:grid-cols-[112px_minmax(0,1fr)_160px_140px] sm:gap-7">
    <div className="h-[110px] w-[88px] overflow-hidden bg-surface-2 sm:h-[140px] sm:w-[112px]">
      {item.primaryImage && <img src={item.primaryImage} alt="" loading="lazy" className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:scale-105" />}
    </div>
    <div className="flex min-w-0 flex-col gap-2">
      <p className="eyebrow">
        {lotNumber(item.id)} <span className="text-muted">· {item.category?.name ?? 'Uncategorised'}</span>
      </p>
      <p className="display text-2xl transition group-hover:text-gold-300 sm:text-3xl">{item.title}</p>
      <p className="text-[13px] text-muted">{item.seller.username}</p>
    </div>
    <div className="col-span-2 flex items-end justify-between gap-6 sm:contents">
      <div>
        <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">{item.hasBids ? 'Current bid' : 'Opening bid'}</p>
        <p className="display tnum text-3xl text-gold-300">{formatMoney(item.currentPrice)}</p>
        <p className="mt-0.5 text-xs text-muted">{plural(item.bidCount, 'bid')}</p>
      </div>
      <div className="text-right">
        <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">{item.status === 'active' ? 'Time left' : 'Status'}</p>
        {item.status === 'active' ? <Countdown endDate={item.endDate} className="text-lg font-medium" /> : <StatusBadge status={item.status} />}
      </div>
    </div>
  </Link>
);
