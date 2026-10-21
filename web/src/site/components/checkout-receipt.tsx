'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import { formatAddress, type AddressFields, type WonLot } from './checkout-types';
import { lotNumber } from './ItemCard';
import { Button, ErrorState, LinkButton, Spinner } from './ui';

interface Order {
  receiptNo: string;
  item: { id: number; title: string };
  shippingTo: AddressFields;
  deliveryMethod: string;
  itemPrice: number;
  shippingCost: number;
  total: number;
  paymentLabel: string;
  paidAt: string;
}

const nextSteps = [
  { numeral: 'I.', title: 'Seller ships', text: 'Within 3 business days of your payment.' },
  { numeral: 'II.', title: 'Delivery', text: 'Signature required on arrival.' },
  { numeral: 'III.', title: 'Rate the seller', text: 'Leave a rating from your won items.' },
];

const delayed = (seconds: number) => ({ animationDelay: `${seconds}s` });

export const Receipt = ({ lot }: { lot: WonLot }) => {
  const order = useQuery({ queryKey: ['order', lot.id], queryFn: () => api.get<Order>(`/me/orders/${lot.id}`) });
  if (order.isPending) return <Spinner />;
  if (order.error) return <ErrorState message={order.error.message} />;
  const { data } = order;
  const lines: [string, string][] = [
    ['Hammer price', formatMoney(data.itemPrice)],
    [data.deliveryMethod, formatMoney(data.shippingCost)],
  ];
  const details: [string, string][] = [
    ['Paid with', data.paymentLabel],
    ['Ships to', formatAddress(data.shippingTo)],
  ];

  return (
    <div className="flex flex-col items-center gap-12 pt-6 pb-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <svg width="96" height="96" viewBox="0 0 72 72" fill="none" aria-hidden>
          <circle cx="36" cy="36" r="34" stroke="var(--color-gold-300)" strokeWidth="1.1" strokeDasharray="214" strokeDashoffset="214" className="animate-[draw_0.8s_cubic-bezier(0.65,0,0.35,1)_forwards]" />
          <path d="M23 37l9 9 17-19" stroke="var(--color-gold-300)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" strokeDashoffset="44" className="animate-[draw_0.5s_var(--ease-expo)_0.6s_forwards]" />
        </svg>
        <p className="eyebrow rise" style={delayed(0.7)}>
          Payment received
        </p>
        <h1 className="display animate-[settle_0.9s_var(--ease-expo)_0.8s_both] text-6xl leading-none md:text-8xl">It&apos;s yours.</h1>
        <p className="rise text-base text-text-2" style={delayed(1)}>
          This receipt is saved under your won items.
        </p>
      </div>
      <article className="rise relative flex w-full max-w-3xl flex-col gap-8 overflow-hidden border border-gold-300/20 bg-surface p-8 shadow-e3 md:px-14 md:py-12" style={delayed(1.1)}>
        <div className="gavel-mask pointer-events-none absolute -right-14 -bottom-10 h-64 w-80 -rotate-[16deg] opacity-[0.07]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="display gold-text text-[28px]">BidNest</span>
            <p className="mt-1.5 text-xs text-muted">Receipt for a won lot</p>
          </div>
          <div className="tnum text-right text-[13px] leading-[1.7] text-text-2">
            <p>
              <span className="text-muted">No.</span> {data.receiptNo}
            </p>
            <p>
              <span className="text-muted">Paid</span> {formatDateTime(data.paidAt)}
            </p>
          </div>
        </div>
        <div className="rule-gold" />
        <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-6">
          {lot.primaryImage ? <img src={lot.primaryImage} alt="" className="size-24 object-cover" /> : <span className="size-24 bg-surface-2" />}
          <div>
            <p className="eyebrow mb-1.5">{lotNumber(data.item.id)}</p>
            <p className="display text-2xl leading-[1.15]">{data.item.title}</p>
            <p className="mt-1 text-[13px] text-muted">{lot.seller.username}</p>
          </div>
          <span className="display tnum text-2xl">{formatMoney(data.itemPrice)}</span>
        </div>
        <div className="flex flex-col text-sm">
          {lines.map(([label, value]) => (
            <div key={label} className="tnum flex justify-between border-t border-line-neutral py-3">
              <span className="text-muted">{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-line-strong pt-4">
            <span className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Total paid</span>
            <span className="display gold-text tnum text-5xl leading-none">{formatMoney(data.total)}</span>
          </div>
        </div>
        <div className="grid gap-8 border-t border-line pt-6 text-sm leading-relaxed sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">{label}</p>
              <p>{value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-line pt-6">
          <p className="mb-4 text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">What happens next</p>
          <div className="grid gap-5 sm:grid-cols-3">
            {nextSteps.map(step => (
              <div key={step.numeral} className="flex flex-col gap-1.5">
                <span className="display text-[22px] text-gold-300">{step.numeral}</span>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-[13px] leading-normal text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </article>
      <div className="rise flex flex-wrap justify-center gap-2.5 print:hidden" style={delayed(1.3)}>
        <Button variant="secondary" size="lg" onClick={() => window.print()}>
          Print receipt
        </Button>
        <LinkButton href="/dashboard/won" size="lg">
          Back to dashboard
        </LinkButton>
      </div>
    </div>
  );
};
