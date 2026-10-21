'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { api, withQuery } from '../lib/api';
import { formatMoney, urgencyOf, type Urgency } from '../lib/format';
import { useNow } from '../lib/hooks';
import { getSocket } from '../lib/socket';
import type { AuctionEnded, BidPlaced, ItemDetail, ListItem } from '../lib/types';
import { AuctionBidPanel, AuctionMobileBar, bidStateOf, mobileBarStates } from './auction-bid-panel';
import { AuctionCountdown } from './auction-countdown';
import { AuctionGallery } from './auction-gallery';
import { AuctionLedger } from './auction-ledger';
import { ItemCard, lotNumber } from './ItemCard';
import { useAuth, useToast } from './Providers';
import { cx, EmptyState, LinkButton, Skeleton, StatusBadge } from './ui';

const MAX_VISIBLE_BIDS = 10;
const SIMILAR_COUNT = 4;

const useLiveAuction = (itemId: number, userId: number | undefined) => {
  const queryClient = useQueryClient();
  const key = ['item', itemId];

  useEffect(() => {
    let cancelled = false;
    let leave: () => void = () => undefined;

    const onBid = (event: BidPlaced) =>
      queryClient.setQueryData<ItemDetail>(key, current =>
        current && {
          ...current,
          currentPrice: event.currentPrice,
          nextMinimumBid: event.nextMinimumBid,
          endDate: event.endDate,
          hasBids: true,
          bidCount: current.bidCount + 1,
          recentBids: [event.bid, ...current.recentBids.filter(bid => bid.id !== event.bid.id)].slice(0, MAX_VISIBLE_BIDS),
          viewer: current.viewer && { ...current.viewer, isLeading: event.bid.bidderId === userId },
        }
      );
    const onEnded = (event: AuctionEnded) => {
      if (event.itemId === itemId) void queryClient.invalidateQueries({ queryKey: key });
    };

    void getSocket().then(socket => {
      if (cancelled) return;
      socket.emit('auction:join', { itemId });
      socket.on('bid:placed', onBid);
      socket.on('auction:ended', onEnded);
      leave = () => {
        socket.emit('auction:leave', { itemId });
        socket.off('bid:placed', onBid);
        socket.off('auction:ended', onEnded);
      };
    });
    return () => {
      cancelled = true;
      leave();
    };
  }, [itemId, userId, queryClient]);
};

const badgeStyles: Record<Urgency, { label: string; style: string }> = {
  normal: { label: 'Live', style: 'bg-live/12 text-live' },
  urgent: { label: 'Ending soon', style: 'bg-outbid/12 text-outbid' },
  critical: { label: 'Ending now', style: 'bg-danger/12 text-danger' },
};

const LiveBadge = ({ endDate }: { endDate: string }) => {
  const badge = badgeStyles[urgencyOf(endDate, useNow())];
  return (
    <span className={cx('inline-flex h-6 items-center gap-[7px] rounded-full px-2.5 text-[10.5px] font-semibold tracking-[0.16em] uppercase', badge.style)} suppressHydrationWarning>
      <span className="live-dot size-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
};

const Sparkline = ({ amounts }: { amounts: number[] }) => {
  const min = Math.min(...amounts);
  const range = Math.max(...amounts) - min || 1;
  const points = amounts.map((amount, index) => [(index / (amounts.length - 1)) * 132, 36 - ((amount - min) / range) * 32] as const);
  const line = points.map(point => point.join(',')).join(' ');
  const last = points[points.length - 1]!;
  return (
    <div className="flex flex-col items-end gap-1 pb-2.5">
      <svg width="132" height="40" viewBox="0 0 132 40" className="overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e7d393" stopOpacity=".28" />
            <stop offset="1" stopColor="#e7d393" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,40 ${line} 132,40`} fill="url(#spark)" />
        <polyline points={line} fill="none" stroke="#e7d393" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="3" fill="#e7d393" />
      </svg>
      <span className="text-xs text-live tnum">↗ {formatMoney(amounts[amounts.length - 1]! - amounts[0]!)} since first bid</span>
    </div>
  );
};

const initialsOf = (name: string) => name.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();

const SellerCard = ({ item }: { item: ItemDetail }) => (
  <div className="flex items-center gap-3.5 border-y border-line py-4">
    <span className="display grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-3 text-[17px] text-gold-300">{initialsOf(item.seller.username)}</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-semibold">{item.seller.username}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
        {item.sellerRating.average !== null ? (
          <>
            <span className="text-gold-300">★</span>
            <span className="text-text tnum">{item.sellerRating.average.toFixed(1)}</span>
            <span className="tnum">({item.sellerRating.count})</span>
          </>
        ) : (
          <span>No ratings yet</span>
        )}
        {item.seller.createdAt && <span>· Member since {new Date(item.seller.createdAt).getFullYear()}</span>}
      </p>
    </div>
  </div>
);

const AboutLot = ({ item }: { item: ItemDetail }) => {
  const details = [
    { label: 'Condition', value: item.condition },
    { label: 'Category', value: item.category?.name },
    { label: 'Opening bid', value: formatMoney(item.minBid) },
    { label: 'Bid increment', value: formatMoney(item.bidIncrement) },
    { label: 'Views', value: item.viewCount.toLocaleString('en-US') },
    { label: 'Watchers', value: item.watcherCount.toLocaleString('en-US') },
  ].filter(detail => detail.value);

  return (
    <div className="grid gap-6 sm:grid-cols-[96px_minmax(0,1fr)]">
      <p className="eyebrow pt-2.5">
        About
        <br />
        the lot
      </p>
      <div className="flex flex-col gap-10">
        <p className="max-w-[620px] text-base leading-[1.7] whitespace-pre-line text-text-2">{item.description || 'The seller has not added a description.'}</p>
        <dl className="grid gap-x-10 sm:grid-cols-2">
          {details.map(detail => (
            <div key={detail.label} className="flex justify-between border-t border-line py-3.5">
              <dt className="text-[13px] text-muted">{detail.label}</dt>
              <dd className="text-sm tnum">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};

const SimilarLots = ({ item }: { item: ItemDetail }) => {
  const categoryId = item.category?.id;
  const similar = useQuery({
    queryKey: ['items', 'similar', categoryId],
    queryFn: () => api.page<ListItem>(withQuery('/items', { categoryId, status: 'active', pageSize: SIMILAR_COUNT + 1 })),
    enabled: Boolean(categoryId),
  });
  const lots = similar.data?.items.filter(lot => lot.id !== item.id).slice(0, SIMILAR_COUNT) ?? [];
  if (lots.length === 0) return null;

  return (
    <section className="mt-24">
      <div className="mb-8 flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-2.5">Also in the room</p>
          <h2 className="display text-4xl md:text-[44px]">Similar lots</h2>
        </div>
        <Link href={`/auctions?categoryId=${categoryId}`} className="text-sm text-text-2 transition hover:text-gold-300">
          All {item.category?.name} →
        </Link>
      </div>
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {lots.map(lot => (
          <ItemCard key={lot.id} item={lot} />
        ))}
      </div>
    </section>
  );
};

const DetailSkeleton = () => (
  <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-[72px]" aria-busy>
    <Skeleton className="aspect-[4/5]" />
    <div className="space-y-6">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-14 w-4/5" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
);

const closedBadgeLabels = { winning: 'Winner', 'no-bids': 'Expired' } as const;

export const AuctionDetail = ({ itemId }: { itemId: number }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const item = useQuery({ queryKey: ['item', itemId], queryFn: () => api.get<ItemDetail>(`/items/${itemId}`) });
  useLiveAuction(itemId, user?.id);

  const toggleWatch = useMutation({
    mutationFn: (watching: boolean) => (watching ? api.delete(`/items/${itemId}/watch`) : api.put(`/items/${itemId}/watch`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item', itemId] }),
    onError: error => toast('error', error.message),
  });

  const share = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => toast('success', 'Link copied to clipboard.'));
  };

  if (item.isPending) return <DetailSkeleton />;
  if (item.error) return <EmptyState title="Auction not found" hint={item.error.message} action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />;

  const data = item.data;
  const state = bidStateOf(data);
  const isLive = data.status === 'active';
  const watching = Boolean(data.viewer?.isWatching);
  const canWatch = Boolean(user) && state !== 'own' && state !== 'pending';
  const hasMobileBar = mobileBarStates.includes(state);
  const metaLine = data.hasBids ? `${data.bidCount} bids · ${data.watcherCount} watchers · opened at ${formatMoney(data.minBid)}` : `Opening bid ${formatMoney(data.minBid)} · increment ${formatMoney(data.bidIncrement)}`;
  const amounts = [...data.recentBids].reverse().map(bid => bid.amount);
  const isPending = data.status === 'pending';

  return (
    <div className={cx(hasMobileBar && 'pb-24 lg:pb-0')}>
      <div className="mb-6 flex items-center justify-between text-[13px] text-muted">
        <nav className="flex items-center gap-2.5">
          <Link href="/auctions" className="transition hover:text-text">
            Auctions
          </Link>
          {data.category && (
            <>
              <span className="text-gold-900">/</span>
              <Link href={`/auctions?categoryId=${data.category.id}`} className="transition hover:text-text">
                {data.category.name}
              </Link>
            </>
          )}
          <span className="text-gold-900">/</span>
          <span className="text-text">{lotNumber(data.id)}</span>
        </nav>
        <button onClick={share} className="inline-flex h-8 items-center rounded-full px-3 font-medium transition hover:bg-surface-2 hover:text-text">
          Share
        </button>
      </div>

      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-[72px]">
        <div className="flex flex-col gap-16 lg:gap-[72px]">
          <AuctionGallery images={data.images} title={data.title} lotId={data.id} />
          <AboutLot item={data} />
          <AuctionLedger bids={data.recentBids} bidCount={data.bidCount} userId={user?.id} isLive={isLive} />
        </div>

        <div className="flex flex-col gap-8 pt-1 lg:sticky lg:top-24">
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-3">
              {isLive ? <LiveBadge endDate={data.endDate} /> : <StatusBadge status={data.status} label={state in closedBadgeLabels ? closedBadgeLabels[state as keyof typeof closedBadgeLabels] : isPending ? 'Pending review' : undefined} />}
              <span className="eyebrow">
                {lotNumber(data.id)} · {data.category?.name ?? 'Uncategorised'}
              </span>
            </div>
            <h1 className="display text-5xl text-balance md:text-[56px]">{data.title}</h1>
            {data.condition && <p className="text-[15px] text-muted">Condition: {data.condition}</p>}
          </div>

          <SellerCard item={data} />

          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">{data.hasBids ? 'Current bid' : 'Opening bid'}</span>
              {isLive && (
                <span className="inline-flex items-center gap-2 text-xs text-text-2 tnum">
                  <span className="live-dot size-[7px] rounded-full bg-live" />
                  {data.watcherCount} watching · {data.bidCount} bids
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-5">
              <p key={data.currentPrice} className="flash display gold-text origin-bottom-left text-7xl leading-[0.92] tracking-[-0.02em] tnum sm:text-[96px]">
                {formatMoney(data.currentPrice)}
              </p>
              {amounts.length > 1 && <Sparkline amounts={amounts} />}
            </div>
            <div className="rule-gold" />
            <p className="text-[13px] text-muted tnum">{metaLine}</p>
          </div>

          {isLive ? (
            <AuctionCountdown endDate={data.endDate} />
          ) : (
            <div className="flex justify-between border-y border-line py-4 text-sm">
              <span className="text-muted">{isPending ? 'Duration' : 'Closed'}</span>
              <span className="tnum" suppressHydrationWarning>
                {isPending ? 'Starts on approval' : new Date(data.endDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          )}

          <div className={cx(hasMobileBar && 'hidden lg:block')}>
            <AuctionBidPanel item={data} state={state} />
          </div>

          {canWatch && (
            <button aria-pressed={watching} disabled={toggleWatch.isPending} onClick={() => toggleWatch.mutate(watching)} className={cx('flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-medium transition hover:bg-gold-300/6 disabled:opacity-60', watching ? 'border-gold-300/45 text-gold-300' : 'border-gold-300/20 text-text')}>
              <span aria-hidden>{watching ? '♥' : '♡'}</span>
              {watching ? `Watching · ${Math.max(data.watcherCount - 1, 0)} others` : 'Add to watchlist'}
            </button>
          )}
        </div>
      </div>

      <SimilarLots item={data} />
      <AuctionMobileBar item={data} state={state} />
    </div>
  );
};
