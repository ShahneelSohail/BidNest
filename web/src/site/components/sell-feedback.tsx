'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { durationDaysOf, formatDate, invalidateSeller, useSellerItem } from '../lib/seller';
import { lotNumber } from './ItemCard';
import { useToast } from './Providers';
import { ConfirmDialog } from './sell-dialog';
import { Icon } from './sell-icons';
import { Button, ErrorState, Eyebrow, LinkButton, Spinner, StatusBadge } from './ui';

export const ListingFeedback = ({ itemId }: { itemId: number }) => {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const item = useSellerItem(itemId);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.delete(`/seller/items/${itemId}`),
    onSuccess: () => {
      toast('success', 'Listing deleted.');
      void invalidateSeller(queryClient);
      router.push('/sell');
    },
    onError: error => toast('error', error.message),
  });
  const status = item.data?.status;

  useEffect(() => {
    if (status && status !== 'rejected') router.replace(`/auctions/${itemId}`);
  }, [status, itemId, router]);

  if (item.error) return <ErrorState message={item.error.message} />;
  if (!item.data || status !== 'rejected') return <Spinner />;

  const listing = item.data;
  const [, ...thumbs] = listing.images;

  return (
    <div className="flex flex-col gap-10">
      <Link href="/sell" className="inline-flex items-center gap-2 self-start text-[13px] text-text-2 transition hover:text-gold-300">
        <Icon name="back" size={15} />
        All listings
      </Link>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="rejected" />
              <Eyebrow className="text-muted!">
                {lotNumber(listing.id)} · {listing.category?.name ?? 'Uncategorised'} · submitted {formatDate(listing.createdAt)}
              </Eyebrow>
            </div>
            <h1 className="display text-5xl md:text-[64px] md:leading-[1.02]">This listing needs changes.</h1>
            <p className="max-w-[640px] text-base leading-relaxed text-text-2">
              “{listing.title}” wasn’t approved yet. Read the note from our moderators below, then list the item again with the fixes. Your photos and details are carried over.
            </p>
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border border-line bg-surface-2 p-6 shadow-e1">
            <span className="display grid size-11 place-items-center rounded-full border border-line-strong bg-surface-3 text-[17px] text-gold-300">T&amp;S</span>
            <div>
              <p className="text-sm font-semibold">
                Trust &amp; Safety <span className="font-normal text-muted">· BidNest</span>
              </p>
              <p className="mt-2 text-[15px] leading-relaxed">“{listing.rejectionReason ?? 'No reason was recorded for this decision.'}”</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <LinkButton href={`/sell/new?from=${listing.id}`} size="lg">
              Edit and resubmit
            </LinkButton>
            <span className="flex-1" />
            {!listing.hasBids && (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete listing
              </Button>
            )}
          </div>
        </div>
        <aside className="flex flex-col gap-3.5">
          <Eyebrow className="text-muted!">As submitted</Eyebrow>
          <div className="aspect-[4/5] overflow-hidden bg-surface-2">
            {listing.primaryImage ? <img src={listing.primaryImage} alt="Submitted cover photo" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-sm text-muted">No photo</div>}
          </div>
          {thumbs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {thumbs.slice(0, 2).map(image => (
                <img key={image.id} src={image.url} alt="" className="aspect-square w-full object-cover" />
              ))}
            </div>
          )}
          <p className="display text-2xl leading-[1.15]">{listing.title}</p>
          <p className="text-[13px] leading-relaxed text-muted">
            Opening bid {formatMoney(listing.minBid)} · {durationDaysOf(listing)} days
          </p>
        </aside>
      </div>
      {confirming && (
        <ConfirmDialog eyebrow={lotNumber(listing.id)} title="Delete this listing?" confirmLabel="Delete listing" pending={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirming(false)}>
          “{listing.title}” and its photos will be permanently removed.
        </ConfirmDialog>
      )}
    </div>
  );
};
