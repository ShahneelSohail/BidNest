'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatMoney, plural } from '../lib/format';
import { analyticsRanges, countsOf, formatDate, formatWholeMoney, statusFilters, useSellerAnalytics, type AnalyticsRange, type SellerAnalytics, type StatusFilter } from '../lib/seller';
import { lotNumber } from './ItemCard';
import { Icon } from './sell-icons';
import { EarningsChart } from './sell-chart';
import { ListingsTable } from './sell-listings';
import { Button, cx, Eyebrow, ErrorState, LinkButton, Segmented, Skeleton } from './ui';

const Tile = ({ label, value, unit, sub, gold }: { label: string; value: string | number; unit?: string; sub?: string; gold?: boolean }) => (
  <div className="border-t border-line pt-4">
    <Eyebrow className="text-muted!">{label}</Eyebrow>
    <p className={cx('display tnum mt-2.5 mb-1.5 text-5xl leading-none', gold && 'gold-text')}>
      {value}
      {unit && <span className="text-2xl text-muted">{unit}</span>}
    </p>
    {sub && <p className="tnum text-[13px] text-muted">{sub}</p>}
  </div>
);

const statTiles = (analytics: SellerAnalytics) => [
  { label: 'Live lots', value: analytics.activeListings, sub: `of ${analytics.totalListings} listings` },
  { label: 'Pending', value: analytics.pendingListings, sub: 'awaiting review' },
  { label: 'Sold', value: analytics.soldItems, sub: `avg ${formatWholeMoney(analytics.averageSellingPrice)} per sale` },
  { label: 'Earnings', value: formatWholeMoney(analytics.totalEarnings), sub: 'all time', gold: true },
  { label: 'Views', value: analytics.totalViews.toLocaleString('en-US'), sub: 'across all listings' },
];

const RejectedBanner = ({ count, onReview }: { count: number; onReview: () => void }) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 rounded-xs border border-danger/30 bg-danger/5 px-6 py-[18px] md:grid-cols-[auto_minmax(0,1fr)_auto]">
    <span className="grid size-9 place-items-center rounded-full bg-danger/15 text-danger">
      <Icon name="alert" strokeWidth={1.75} />
    </span>
    <div>
      <p className="text-[15px] font-semibold">
        {count} {count === 1 ? 'listing needs' : 'listings need'} changes before {count === 1 ? 'it' : 'they'} can go live
      </p>
      <p className="mt-[3px] text-[13px] text-text-2">Read the moderator’s notes, then list the item again with the fixes.</p>
    </div>
    <Button variant="secondary" className="col-span-2 border-danger/45 text-text md:col-span-1" onClick={onReview}>
      Review feedback
    </Button>
  </div>
);

const Earnings = ({ range, onRangeChange }: { range: AnalyticsRange; onRangeChange: (range: AnalyticsRange) => void }) => {
  const analytics = useSellerAnalytics(range.key);
  const total = analytics.data?.dailyEarnings.reduce((sum, day) => sum + day.earnings, 0) ?? 0;

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow className="text-muted!">Earnings · {range.summary}</Eyebrow>
            <p className="display gold-text tnum mt-2.5 text-6xl leading-none md:text-7xl">{formatWholeMoney(total)}</p>
          </div>
          <Segmented options={analyticsRanges.map(({ key, label }) => ({ key, label }))} value={range.key} onChange={key => onRangeChange(analyticsRanges.find(option => option.key === key)!)} />
        </div>
        {analytics.data ? <EarningsChart daily={analytics.data.dailyEarnings} range={range} /> : <Skeleton className="h-60" />}
      </div>
      {analytics.data && (
        <div className="flex flex-col gap-7">
          <Tile label="Sell-through" value={Math.round(analytics.data.conversionRate)} unit="%" sub={`${analytics.data.soldItems} sold of ${analytics.data.totalListings} listed`} />
          <div className="border-t border-line pt-4">
            <Eyebrow className="text-muted!">Top categories</Eyebrow>
            {analytics.data.topCategories.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">List an item to see your categories.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {analytics.data.topCategories.map(category => (
                  <li key={category.name}>
                    <div className="flex justify-between text-[13px]">
                      <span>{category.name}</span>
                      <span className="tnum text-muted">{category.count}</span>
                    </div>
                    <div className="mt-1.5 h-1 bg-surface-3">
                      <div className="h-full bg-gold-300" style={{ width: `${(category.count / analytics.data.topCategories[0]!.count) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RecentSales = ({ sales }: { sales: SellerAnalytics['recentSales'] }) =>
  sales.length > 0 && (
    <section>
      <h2 className="display mb-4 text-4xl md:text-[44px]">Recent sales</h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-14 md:grid-cols-2">
        {sales.map(sale => (
          <li key={sale.id}>
            <Link href={`/auctions/${sale.id}`} className="flex items-center gap-4 border-b border-line py-3.5 transition hover:bg-gold-300/[0.03]">
              {sale.primaryImage ? <img src={sale.primaryImage} alt="" className="size-14 shrink-0 object-cover" /> : <span className="size-14 shrink-0 border border-dashed border-line-strong" />}
              <div className="min-w-0 flex-1">
                <p className="display truncate text-[19px] leading-[1.2]">{sale.title}</p>
                <p className="mt-[3px] text-xs text-muted">
                  {lotNumber(sale.id)} · sold {formatDate(sale.endDate)} · {plural(sale.bidCount, 'bid')}
                </p>
              </div>
              <p className="display gold-text tnum text-xl">{formatMoney(sale.currentPrice)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

export const SellDashboard = ({ initialStatus }: { initialStatus?: string }) => {
  const [status, setStatus] = useState<StatusFilter>(statusFilters.find(option => option === initialStatus) ?? 'all');
  const [range, setRange] = useState<AnalyticsRange>(analyticsRanges[0]);
  const analytics = useSellerAnalytics('30');

  return (
    <div className="flex flex-col gap-14">
      <div className="rise flex flex-wrap items-end justify-between gap-6 border-b border-line-strong pb-8">
        <div>
          <Eyebrow className="mb-3.5">Seller · {analytics.data?.activeListings ?? 0} lots on the block</Eyebrow>
          <h1 className="display text-6xl md:text-[80px] md:leading-[0.98]">Your saleroom.</h1>
        </div>
        <LinkButton href="/sell/new" size="lg">
          <Icon name="plus" strokeWidth={1.75} />
          List a new lot
        </LinkButton>
      </div>
      {analytics.error && <ErrorState message={analytics.error.message} />}
      {analytics.data && analytics.data.rejectedListings > 0 && <RejectedBanner count={analytics.data.rejectedListings} onReview={() => setStatus('rejected')} />}
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5">
        {analytics.data
          ? statTiles(analytics.data).map(tile => <Tile key={tile.label} {...tile} />)
          : Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28" />)}
      </div>
      <Earnings range={range} onRangeChange={setRange} />
      {analytics.data && <RecentSales sales={analytics.data.recentSales} />}
      <ListingsTable status={status} counts={analytics.data && countsOf(analytics.data)} onStatusChange={setStatus} />
    </div>
  );
};
