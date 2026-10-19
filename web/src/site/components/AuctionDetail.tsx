'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import { getSocket } from '../lib/socket';
import type { AuctionEnded, BidPlaced, ItemDetail } from '../lib/types';
import { Countdown } from './ItemCard';
import { useAuth, useToast } from './Providers';
import { Button, Card, EmptyState, ErrorState, Input, LinkButton, Spinner, StatusBadge } from './ui';

const MAX_VISIBLE_BIDS = 10;

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

const BidPanel = ({ item }: { item: ItemDetail }) => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const placeBid = useMutation({
    mutationFn: (value: number) => api.post(`/items/${item.id}/bids`, { amount: value }),
    onSuccess: () => {
      setAmount('');
      toast('success', 'Bid placed. You are the highest bidder.');
      void queryClient.invalidateQueries({ queryKey: ['item', item.id] });
    },
    onError: error => toast('error', error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    placeBid.mutate(Number(amount || item.nextMinimumBid));
  };

  if (!user) return <LinkButton href={`/login?next=/auctions/${item.id}`} className="w-full">Log in to bid</LinkButton>;
  if (item.viewer?.isSeller) return <p className="text-sm text-muted">This is your listing.</p>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <Input type="number" min={item.nextMinimumBid} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`${formatMoney(item.nextMinimumBid)} or more`} aria-label="Bid amount" />
        <Button type="submit" disabled={placeBid.isPending}>
          {placeBid.isPending ? 'Bidding…' : 'Place bid'}
        </Button>
      </div>
      <p className="text-xs text-muted">Minimum next bid: {formatMoney(item.nextMinimumBid)}</p>
    </form>
  );
};

const ViewerStatus = ({ item }: { item: ItemDetail }) => {
  const viewer = item.viewer;
  if (!viewer || viewer.isSeller) return null;
  if (viewer.isWinner) return <LinkButton href="/dashboard/won" className="w-full">You won! Complete payment</LinkButton>;
  if (item.status === 'active' && viewer.isLeading) return <p className="rounded-xl bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">You are the highest bidder.</p>;
  if (item.status === 'active' && viewer.myHighestBid) return <p className="rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-300">You have been outbid. Your highest bid: {formatMoney(viewer.myHighestBid)}</p>;
  return null;
};

export const AuctionDetail = ({ itemId }: { itemId: number }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [imageIndex, setImageIndex] = useState(0);
  const item = useQuery({ queryKey: ['item', itemId], queryFn: () => api.get<ItemDetail>(`/items/${itemId}`) });
  useLiveAuction(itemId, user?.id);

  const toggleWatch = useMutation({
    mutationFn: (watching: boolean) => (watching ? api.delete(`/items/${itemId}/watch`) : api.put(`/items/${itemId}/watch`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item', itemId] }),
    onError: error => toast('error', error.message),
  });

  if (item.isPending) return <Spinner />;
  if (item.error) return <EmptyState title="Auction not found" hint={item.error.message} action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />;

  const data = item.data;
  const isLive = data.status === 'active';
  const image = data.images[imageIndex] ?? data.images[0];

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface-2">
          {image ? (
            <img src={image.url} alt={data.title} className="size-full object-contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted">No image</div>
          )}
        </div>
        {data.images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto">
            {data.images.map((thumb, index) => (
              <button key={thumb.id} onClick={() => setImageIndex(index)} className={`size-20 shrink-0 overflow-hidden rounded-xl border ${index === imageIndex ? 'border-yellow' : 'border-line'}`}>
                <img src={thumb.url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <Card>
          <h2 className="mb-2 font-medium">Description</h2>
          <p className="text-sm whitespace-pre-line text-muted">{data.description || 'The seller has not added a description.'}</p>
        </Card>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-sm text-muted">{data.category?.name ?? 'Uncategorised'}</span>
          </div>
          <h1 className="text-3xl font-semibold">{data.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Sold by {data.seller.username}
            {data.sellerRating.average !== null && ` · ${data.sellerRating.average.toFixed(1)}★ (${data.sellerRating.count})`}
          </p>
        </div>

        <Card className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted">{data.hasBids ? 'Current bid' : 'Starting bid'}</p>
              <p className="text-4xl font-semibold text-yellow">{formatMoney(data.currentPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">{isLive ? 'Time left' : 'Ended'}</p>
              <p className="text-xl font-medium">{isLive ? <Countdown endDate={data.endDate} /> : formatDateTime(data.endDate)}</p>
            </div>
          </div>
          {isLive && <BidPanel item={data} />}
          <ViewerStatus item={data} />
          {user && !data.viewer?.isSeller && (
            <Button variant="secondary" className="w-full" disabled={toggleWatch.isPending} onClick={() => toggleWatch.mutate(Boolean(data.viewer?.isWatching))}>
              {data.viewer?.isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
            </Button>
          )}
          {data.rejectionReason && <ErrorState message={`Rejected: ${data.rejectionReason}`} />}
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Bid history · {data.bidCount}</h2>
          {data.recentBids.length === 0 ? (
            <p className="text-sm text-muted">No bids yet. Be the first!</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.recentBids.map(bid => (
                <li key={bid.id} className="flex items-center justify-between py-2.5">
                  <span>
                    {bid.bidderName} <span className="text-xs text-muted">{formatDateTime(bid.bidTime)}</span>
                  </span>
                  <span className="font-medium">{formatMoney(bid.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Link href="/auctions" className="inline-block text-sm text-muted hover:text-white">
          ← Back to auctions
        </Link>
      </div>
    </div>
  );
};
