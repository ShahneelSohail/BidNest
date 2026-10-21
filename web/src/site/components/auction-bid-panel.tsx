'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { ItemDetail } from '../lib/types';
import { useToast } from './Providers';
import { Button, cx, Eyebrow, LinkButton } from './ui';

export type BidState = 'guest' | 'open' | 'leading' | 'outbid' | 'winning' | 'sold' | 'no-bids' | 'own' | 'pending';

export const bidStateOf = (item: ItemDetail): BidState => {
  const { viewer } = item;
  if (item.status === 'pending' || item.status === 'rejected') return 'pending';
  if (viewer?.isSeller) return 'own';
  if (item.status === 'sold') return viewer?.isWinner ? 'winning' : 'sold';
  if (item.status === 'expired') return 'no-bids';
  if (!viewer) return 'guest';
  if (viewer.isLeading) return 'leading';
  return viewer.myHighestBid ? 'outbid' : 'open';
};

const panelStyles: Record<BidState, string> = {
  guest: 'border-line',
  open: 'border-line',
  leading: 'border-live/30',
  outbid: 'border-outbid/40',
  winning: 'border-gold-300 shadow-e2',
  sold: 'border-line',
  'no-bids': 'border-line',
  own: 'border-line',
  pending: 'border-info/30',
};

const SUCCESS_MS = 2400;

type Step = 'idle' | 'confirm' | 'success';

const Banner = ({ tone, title, children }: { tone: 'live' | 'outbid'; title: string; children: ReactNode }) => (
  <div className={cx('rise flex items-center gap-3 rounded-xs border px-3.5 py-3', tone === 'live' ? 'border-live/25 bg-live/8' : 'border-outbid/30 bg-outbid/8')}>
    <span className={cx('grid size-[26px] shrink-0 place-items-center rounded-full text-sm font-bold', tone === 'live' ? 'bg-live/16 text-live' : 'bg-outbid/16 text-outbid')}>{tone === 'live' ? '✓' : '!'}</span>
    <div className="flex-1">
      <p className={cx('text-sm font-semibold', tone === 'live' ? 'text-live' : 'text-outbid')}>{title}</p>
      <p className="mt-0.5 text-xs text-text-2 tnum">{children}</p>
    </div>
  </div>
);

const CheckDraw = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
    <circle cx="36" cy="36" r="34" stroke="#e7d393" strokeWidth="1.5" strokeDasharray="214" strokeDashoffset="214" style={{ animation: 'draw .7s cubic-bezier(.65,0,.35,1) forwards' }} />
    <path d="M23 37l9 9 17-19" stroke="#e7d393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'draw .45s cubic-bezier(.16,1,.3,1) .55s forwards' }} />
  </svg>
);

const SummaryRow = ({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) => (
  <div className={cx('flex justify-between border-t border-line py-2.5 text-sm', last && 'border-b')}>
    <span className="text-muted">{label}</span>
    <span className={cx('tnum', strong && 'font-semibold')}>{value}</span>
  </div>
);

const BidForm = ({ item, state }: { item: ItemDetail; state: BidState }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('idle');
  const [chipIndex, setChipIndex] = useState(0);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const chips = [
    { label: '+ Min', amount: item.nextMinimumBid },
    { label: '+ 2×', amount: item.currentPrice + item.bidIncrement * 2 },
    { label: '+ 5×', amount: item.currentPrice + item.bidIncrement * 5 },
  ];
  const amount = custom ? Number(custom) : chips[chipIndex]!.amount;

  const placeBid = useMutation({
    mutationFn: () => api.post(`/items/${item.id}/bids`, { amount }),
    onSuccess: () => {
      setCustom('');
      setChipIndex(0);
      setStep('success');
      void queryClient.invalidateQueries({ queryKey: ['item', item.id] });
    },
    onError: failure => {
      setStep('idle');
      toast('error', failure.message);
    },
  });

  useEffect(() => {
    if (step !== 'success') return;
    const timer = setTimeout(() => setStep('idle'), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const review = () => {
    if (!Number.isFinite(amount) || amount < item.nextMinimumBid) {
      setError(`Bid at least ${formatMoney(item.nextMinimumBid)}`);
      return;
    }
    setError(null);
    setStep('confirm');
  };

  return (
    <>
      {state === 'leading' && <Banner tone="live" title="You're the highest bidder">Your bid {formatMoney(item.viewer?.myHighestBid)}. We&apos;ll notify you if someone outbids you.</Banner>}
      {state === 'outbid' && <Banner tone="outbid" title="You've been outbid">Your highest bid {formatMoney(item.viewer?.myHighestBid)}. Bid {formatMoney(item.nextMinimumBid)} to lead again.</Banner>}

      {step === 'idle' && (
        <>
          <div className="flex flex-col gap-2.5">
            <Eyebrow className="text-muted!">Quick bid</Eyebrow>
            <div className="grid grid-cols-3 gap-2">
              {chips.map((chip, index) => {
                const on = !custom && index === chipIndex;
                return (
                  <button key={chip.label} aria-pressed={on} onClick={() => { setChipIndex(index); setCustom(''); setError(null); }} className={cx('flex h-14 flex-col items-center justify-center gap-px rounded-full border transition hover:border-gold-300', on ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-gold-300/20 text-text')}>
                    <span className="text-[11px] tracking-[0.06em] opacity-80">{chip.label}</span>
                    <span className="text-[15px] font-semibold tnum">{formatMoney(chip.amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`bid-${item.id}`} className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">
              Or enter your bid
            </label>
            <div className={cx('flex h-[52px] items-center gap-2 rounded-sm border bg-surface px-4 transition', error ? 'border-danger' : custom ? 'border-gold-300' : 'border-gold-300/20')}>
              <span className="display text-[22px] text-muted">$</span>
              <input id={`bid-${item.id}`} value={custom} onChange={event => { setCustom(event.target.value.replace(/[^0-9]/g, '')); setError(null); }} inputMode="numeric" placeholder={`${item.nextMinimumBid.toLocaleString('en-US')} or more`} aria-invalid={Boolean(error)} className="h-full min-w-0 flex-1 bg-transparent text-lg font-medium text-text outline-none tnum placeholder:text-muted" />
              <span className="text-xs text-muted">USD</span>
            </div>
            {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          </div>
          <Button size="lg" onClick={review} className="w-full text-base tnum active:scale-[0.985]">
            Place bid · {formatMoney(amount)}
          </Button>
          <p className="text-center text-xs text-muted tnum">Minimum {formatMoney(item.nextMinimumBid)} · Increment {formatMoney(item.bidIncrement)} · Bids are binding</p>
        </>
      )}

      {step === 'confirm' && (
        <div className="rise flex flex-col gap-5">
          <div>
            <Eyebrow className="mb-1.5">Confirm your bid</Eyebrow>
            <p className="display text-6xl tnum">{formatMoney(amount)}</p>
          </div>
          <div className="flex flex-col">
            <SummaryRow label="Current bid" value={formatMoney(item.currentPrice)} />
            <SummaryRow label="Your bid" value={formatMoney(amount)} strong last />
          </div>
          <p className="text-[13px] leading-relaxed text-text-2">This bid is binding. If you win, you&apos;ll be asked to complete payment.</p>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="secondary" disabled={placeBid.isPending} onClick={() => setStep('idle')} className="h-[52px] text-text">
              Change
            </Button>
            <Button variant="gold" disabled={placeBid.isPending} onClick={() => placeBid.mutate()} className="h-[52px] bg-gradient-to-b from-gold-200 to-gold-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_30px_-8px_rgba(231,211,147,0.6)]">
              {placeBid.isPending && <span className="size-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />}
              {placeBid.isPending ? 'Placing bid…' : 'Confirm bid'}
            </Button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-3.5 pt-5 pb-3 text-center">
          <CheckDraw />
          <p className="display text-3xl">Bid placed</p>
          <p className="text-sm text-text-2 tnum">You lead at {formatMoney(item.currentPrice)}.</p>
        </div>
      )}
    </>
  );
};

const ClosedNotice = ({ title, children }: { title: string; children: ReactNode }) => (
  <>
    <p className="display text-3xl">{title}</p>
    <p className="text-sm leading-relaxed text-text-2">{children}</p>
  </>
);

const StateContent = ({ item, state }: { item: ItemDetail; state: BidState }) => {
  switch (state) {
    case 'guest':
      return (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-2">Next minimum bid</span>
            <span className="display text-[26px] tnum">{formatMoney(item.nextMinimumBid)}</span>
          </div>
          <LinkButton href={`/login?next=/auctions/${item.id}`} size="lg" className="w-full text-[15px]">
            Log in to bid →
          </LinkButton>
          <p className="text-center text-[13px] text-muted">
            New to BidNest?{' '}
            <Link href={`/register?next=/auctions/${item.id}`} className="text-gold-300">
              Create an account
            </Link>{' '}
            to bid and watch lots.
          </p>
        </>
      );
    case 'open':
    case 'leading':
    case 'outbid':
      return <BidForm item={item} state={state} />;
    case 'winning':
      return (
        <>
          <div className="flex items-center gap-5">
            <div className="gavel-mask size-[72px] shrink-0" />
            <div>
              <Eyebrow className="mb-1">Winner</Eyebrow>
              <p className="display text-[32px] leading-[1.05]">You won this lot</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-text-2">
            Pay <span className="tnum">{formatMoney(item.currentPrice)}</span> to secure it. The seller ships once payment is received.
          </p>
          <LinkButton href="/dashboard/won" variant="gold" size="lg" className="w-full bg-gradient-to-b from-gold-200 to-gold-500 text-base">
            Complete payment →
          </LinkButton>
        </>
      );
    case 'sold':
      return <ClosedNotice title="Bidding has closed">This lot sold to {item.recentBids[0]?.bidderName ?? 'the top bidder'} after {item.bidCount} bids.</ClosedNotice>;
    case 'no-bids':
      return <ClosedNotice title="Passed without bids">The lot closed at its opening bid of {formatMoney(item.minBid)} with no offers. The seller can relist it.</ClosedNotice>;
    case 'own':
      return (
        <>
          <Eyebrow>Your listing</Eyebrow>
          <div className="grid grid-cols-3 border-y border-line">
            {[
              { label: 'Bids', value: item.bidCount },
              { label: 'Watchers', value: item.watcherCount },
              { label: 'Views', value: item.viewCount },
            ].map((stat, index) => (
              <div key={stat.label} className={cx('py-4', index > 0 && 'border-l border-line pl-5')}>
                <p className="display text-4xl leading-none tnum">{stat.value}</p>
                <p className="mt-1.5 text-xs text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted">Sellers can&apos;t bid on their own lots. Editing and ending early are locked once a lot has bids.</p>
        </>
      );
    case 'pending':
      return item.status === 'rejected' ? (
        <ClosedNotice title="Listing rejected">{item.rejectionReason ?? 'An admin rejected this listing.'}</ClosedNotice>
      ) : (
        <ClosedNotice title="Awaiting approval">An admin is reviewing this listing. Only you can see this page. Bidding opens as soon as it&apos;s approved, and you&apos;ll get a notification.</ClosedNotice>
      );
  }
};

export const AuctionBidPanel = ({ item, state }: { item: ItemDetail; state: BidState }) => (
  <div className={cx('flex flex-col gap-5 rounded-xs border bg-surface-2 p-6 transition-[border-color,box-shadow] duration-200 sm:p-7', panelStyles[state])}>
    <StateContent item={item} state={state} />
  </div>
);

export const mobileBarStates: BidState[] = ['guest', 'open', 'leading', 'outbid', 'winning'];

export const AuctionMobileBar = ({ item, state }: { item: ItemDetail; state: BidState }) => {
  const [open, setOpen] = useState(false);
  if (!mobileBarStates.includes(state)) return null;

  const cta =
    state === 'guest' ? (
      <LinkButton href={`/login?next=/auctions/${item.id}`} size="lg" className="px-6">
        Log in to bid
      </LinkButton>
    ) : state === 'winning' ? (
      <LinkButton href="/dashboard/won" variant="gold" size="lg" className="px-6">
        Pay now
      </LinkButton>
    ) : (
      <Button size="lg" className="px-6" onClick={() => setOpen(true)}>
        Place bid
      </Button>
    );

  return (
    <>
      <div className="fixed right-0 bottom-0 left-0 z-40 flex items-center gap-3 border-t border-line bg-surface/92 px-4 pt-3 pb-5 backdrop-blur-xl lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.2em] text-muted uppercase">{item.hasBids ? 'Current bid' : 'Opening bid'}</p>
          <p className="display mt-0.5 text-2xl leading-none tnum">{formatMoney(item.currentPrice)}</p>
        </div>
        {cta}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div role="dialog" aria-label="Place a bid" className="rise absolute right-0 bottom-0 left-0 flex max-h-[92%] flex-col gap-4 overflow-y-auto rounded-t-md border-t border-line-strong bg-surface-2 px-5 pt-3 pb-8">
            <span className="h-1 w-9 self-center rounded-full bg-white/18" />
            <AuctionBidPanel item={item} state={state} />
          </div>
        </div>
      )}
    </>
  );
};
