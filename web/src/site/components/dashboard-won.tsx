'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { formatShortDate } from '../lib/time';
import type { ListItem } from '../lib/types';
import { SectionHeading } from './dashboard';
import { Icon } from './dashboard-icons';
import { lotNumber } from './ItemCard';
import { useToast } from './Providers';
import { Button, cx, EmptyState, ErrorState, LinkButton, Spinner, Textarea } from './ui';

interface WonItem extends ListItem {
  seller: { id: number; username: string };
  paid: boolean;
  myRating: { score: number; comment: string | null } | null;
}

const steps = ['Won', 'Paid', 'Rated'];
const starLabels = ['Tap to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const starValues = [1, 2, 3, 4, 5];

const stageOf = (item: WonItem) => (item.myRating ? 2 : item.paid ? 1 : 0);

const StepTrack = ({ stage }: { stage: number }) => (
  <ol className="flex">
    {steps.map((label, index) => {
      const last = index === steps.length - 1;
      const done = index < stage || (last && stage === index);
      const current = index === stage && !last;
      return (
        <li key={label} className="flex flex-1 flex-col gap-2.5">
          <div className="flex items-center">
            <span className={cx('grid size-6 flex-none place-items-center rounded-full border text-ink', done ? 'border-gold-300 bg-gold-300' : current ? 'border-gold-300 shadow-[0_0_0_4px_rgb(231_211_147/0.15)]' : 'border-white/18')}>
              {done && <Icon name="check" size={12} strokeWidth={2.4} />}
            </span>
            {!last && <span className={cx('h-px flex-1', index < stage ? 'bg-gold-300' : 'bg-white/14')} />}
          </div>
          <span className={cx('text-xs', current ? 'font-semibold text-gold-300' : done ? 'text-text' : 'text-muted')}>{label}</span>
        </li>
      );
    })}
  </ol>
);

const RatingPanel = ({ item }: { item: WonItem }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const rate = useMutation({
    mutationFn: () => api.post(`/me/won/${item.id}/rating`, { score, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast('success', `Thanks for rating ${item.seller.username}.`);
      return queryClient.invalidateQueries({ queryKey: ['won'] });
    },
    onError: error => toast('error', error.message),
  });

  return (
    <div className="flex flex-col gap-4 border border-line-strong bg-surface-2 p-6 shadow-e1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="display text-2xl">How was {item.seller.username}?</p>
        <span className="text-xs text-muted">Your rating is public</span>
      </div>
      <div className="flex items-center gap-4">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {starValues.map(value => (
            <button key={value} role="radio" aria-checked={score === value} aria-label={`${value} stars`} onClick={() => setScore(value)} className={cx('grid size-11 place-items-center transition hover:scale-110', value <= score ? 'text-gold-300' : 'text-[#5a5750]')}>
              <Icon name="star" size={28} filled={value <= score} strokeWidth={1.25} />
            </button>
          ))}
        </div>
        <span className="text-sm text-text-2">{starLabels[score]}</span>
      </div>
      <Textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} placeholder="Anything other buyers should know? (optional)" aria-label="Comment" className="min-h-20" />
      <div className="flex justify-end">
        <Button disabled={!score || rate.isPending} onClick={() => rate.mutate()}>
          {rate.isPending ? 'Submitting…' : 'Submit rating'}
        </Button>
      </div>
    </div>
  );
};

const WonRow = ({ item }: { item: WonItem }) => (
  <div className="grid gap-6 border-t border-line-strong py-8 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-10">
    <div className="relative aspect-[4/5] max-w-56 overflow-hidden bg-surface-2 sm:max-w-none">
      {item.primaryImage && <img src={item.primaryImage} alt={item.title} className="size-full object-cover" />}
      <span className="absolute top-3 left-3 inline-flex h-6 items-center rounded-full bg-gradient-to-b from-gold-200 to-gold-500 px-2.5 text-[10px] font-bold tracking-[0.16em] text-ink uppercase">Winner</span>
    </div>
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">
            {lotNumber(item.id)} · won {formatShortDate(item.endDate)} · from {item.seller.username}
          </p>
          <h2 className="display text-3xl leading-[1.08] md:text-4xl">{item.title}</h2>
        </div>
        <div className="sm:text-right">
          <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">Hammer price</p>
          <p className="display gold-text tnum text-4xl leading-none">{formatMoney(item.currentPrice)}</p>
        </div>
      </div>
      <StepTrack stage={stageOf(item)} />
      {!item.paid && (
        <div className="flex flex-wrap items-center gap-5 border border-outbid/30 bg-surface-2 px-6 py-5">
          <div className="min-w-48 flex-1">
            <p className="text-[15px] font-semibold">Payment due</p>
            <p className="tnum mt-1 text-[13px] text-text-2">{formatMoney(item.currentPrice)} plus the delivery option you choose at checkout.</p>
          </div>
          <LinkButton href={`/checkout/${item.id}`} variant="gold">
            Pay now
          </LinkButton>
        </div>
      )}
      {item.paid && !item.myRating && <RatingPanel item={item} />}
      {item.myRating && (
        <div className="flex items-center gap-3.5 border-t border-line py-4">
          <span className="text-live">
            <Icon name="check" size={22} strokeWidth={2} />
          </span>
          <p className="text-sm text-text-2">
            You rated {item.seller.username} <span className="tracking-widest text-gold-300">{'★'.repeat(item.myRating.score)}</span>. Thank you, it helps other collectors.
          </p>
        </div>
      )}
      {item.paid && (
        <Link href={`/checkout/${item.id}`} className="self-start text-[13px] text-text-2 underline decoration-line-strong underline-offset-4 transition hover:text-gold-300">
          View receipt
        </Link>
      )}
    </div>
  </div>
);

export const WonAuctions = () => {
  const won = useQuery({ queryKey: ['won'], queryFn: () => api.get<WonItem[]>('/me/won') });
  return (
    <>
      <SectionHeading eyebrow="Buying" title="Won items" />
      {won.isPending && <Spinner />}
      {won.error && <ErrorState message={won.error.message} />}
      {won.data?.length === 0 && <EmptyState title="You haven't won an auction yet" hint="Lots you win appear here, ready to pay." action={<LinkButton href="/auctions">Browse auctions</LinkButton>} />}
      {won.data?.map(item => (
        <WonRow key={item.id} item={item} />
      ))}
    </>
  );
};
