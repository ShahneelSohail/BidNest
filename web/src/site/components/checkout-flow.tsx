'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { formatShortDate } from '../lib/time';
import { CardForm, cardBrand, cardErrors, cardLast4, emptyCard, type CardBrand } from './checkout-card';
import { Receipt } from './checkout-receipt';
import { formatAddress, type Address, type AddressFields, type DeliveryOption, type WonLot } from './checkout-types';
import { Icon } from './dashboard-icons';
import { lotNumber } from './ItemCard';
import { useAuth, useToast } from './Providers';
import { RequireAuth } from './RequireAuth';
import { Button, cx, EmptyState, ErrorState, LinkButton, Spinner } from './ui';

const stepLabels = ['Shipping', 'Payment', 'Review'];
const stepTitles = ['Where should it go?', 'How will you pay?', 'Check and pay'];

interface Payment {
  brand: CardBrand;
  last4: string;
}

const addressInputs: { key: keyof AddressFields; label: string; placeholder: string; required: boolean; span: string }[] = [
  { key: 'label', label: 'Label', placeholder: 'Home', required: true, span: 'col-span-2 sm:col-span-1' },
  { key: 'name', label: 'Full name', placeholder: 'Elena Marsh', required: true, span: 'col-span-2 sm:col-span-1' },
  { key: 'line1', label: 'Street address', placeholder: '221 Kent Avenue', required: true, span: 'col-span-2' },
  { key: 'line2', label: 'Apartment, suite (optional)', placeholder: 'Apt 4', required: false, span: 'col-span-2' },
  { key: 'city', label: 'City', placeholder: 'Brooklyn', required: true, span: 'col-span-2 sm:col-span-1' },
  { key: 'region', label: 'State or region', placeholder: 'NY', required: true, span: 'col-span-2 sm:col-span-1' },
  { key: 'postal', label: 'ZIP or postal code', placeholder: '11249', required: true, span: 'col-span-2 sm:col-span-1' },
  { key: 'country', label: 'Country', placeholder: 'USA', required: true, span: 'col-span-2 sm:col-span-1' },
];

const RadioDot = ({ on }: { on: boolean }) => (
  <span className={cx('grid size-5 flex-none place-items-center rounded-full border', on ? 'border-gold-300' : 'border-line-strong')}>
    <span className={cx('size-2.5 rounded-full bg-gold-300 transition-transform duration-150 ease-[var(--ease-expo)]', on ? 'scale-100' : 'scale-0')} />
  </span>
);

const NewAddressForm = ({ onSaved }: { onSaved: (address: Address) => void }) => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<keyof AddressFields, string>>({ label: 'Home', name: user?.fullName ?? '', line1: '', line2: '', city: '', region: '', postal: '', country: '' });
  const save = useMutation({
    mutationFn: () => api.post<Address>('/me/addresses', { ...values, line2: values.line2 || undefined }),
    onSuccess: async address => {
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      onSaved(address);
    },
    onError: error => toast('error', error.message),
  });
  const complete = addressInputs.every(input => !input.required || values[input.key].trim());

  return (
    <div className="rise grid grid-cols-2 gap-4">
      {addressInputs.map(input => (
        <label key={input.key} className={cx('flex flex-col gap-2', input.span)}>
          <span className="text-[13px] text-text-2">{input.label}</span>
          <input
            value={values[input.key]}
            onChange={event => setValues({ ...values, [input.key]: event.target.value })}
            placeholder={input.placeholder}
            maxLength={input.key === 'label' ? 40 : 120}
            className="h-12 rounded-[4px] border border-line-strong bg-surface px-3.5 text-[15px] text-text outline-none transition placeholder:text-muted focus:border-gold-300 focus:shadow-[0_0_0_3px_rgb(231_211_147/0.15)]"
          />
        </label>
      ))}
      <Button className="col-span-2 self-start justify-self-start" disabled={!complete || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? 'Saving…' : 'Save address'}
      </Button>
    </div>
  );
};

const ShippingStep = ({ addresses, addressId, onAddress, options, deliveryKey, onDelivery }: { addresses: Address[]; addressId: number | undefined; onAddress: (id: number) => void; options: DeliveryOption[]; deliveryKey: DeliveryOption['key']; onDelivery: (key: DeliveryOption['key']) => void }) => {
  const [adding, setAdding] = useState(addresses.length === 0);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3.5">
        <h2 className="display text-3xl">Ship to</h2>
        <div role="radiogroup" aria-label="Shipping address" className="grid gap-3.5 sm:grid-cols-2">
          {addresses.map(address => {
            const on = address.id === addressId && !adding;
            return (
              <button key={address.id} role="radio" aria-checked={on} onClick={() => { setAdding(false); onAddress(address.id); }} className={cx('flex gap-3.5 rounded-xs border p-5 text-left transition hover:border-gold-300', on ? 'border-gold-300/55 bg-surface-2 shadow-e2' : 'border-line')}>
                <span className="mt-0.5">
                  <RadioDot on={on} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">{address.label}</span>
                  <span className="text-sm leading-normal text-text-2">{formatAddress(address)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setAdding(value => !value)} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-gold-300">
          <Icon name="plus" size={15} />
          {adding ? 'Cancel' : 'Add a new address'}
        </button>
        {adding && (
          <NewAddressForm
            onSaved={address => {
              setAdding(false);
              onAddress(address.id);
            }}
          />
        )}
      </div>
      <div className="flex flex-col gap-3.5">
        <h2 className="display text-3xl">Delivery</h2>
        <div role="radiogroup" aria-label="Delivery option" className="flex flex-col border-t border-line">
          {options.map(option => (
            <button key={option.key} role="radio" aria-checked={option.key === deliveryKey} onClick={() => onDelivery(option.key)} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-5 text-left">
              <RadioDot on={option.key === deliveryKey} />
              <span>
                <span className="block text-[15px] font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{option.detail}</span>
              </span>
              <span className={cx('display text-[22px]', option.key === deliveryKey ? 'text-gold-300' : 'text-text')}>{formatMoney(option.cost)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Summary = ({ lot, delivery, className }: { lot: WonLot; delivery: DeliveryOption; className?: string }) => {
  const total = lot.currentPrice + delivery.cost;
  const rows: [string, ReactNode][] = [
    ['Hammer price', formatMoney(lot.currentPrice)],
    [delivery.label, formatMoney(delivery.cost)],
    ["Buyer's premium", <span className="text-live">None</span>],
  ];
  return (
    <aside className={cx('flex flex-col rounded-xs border border-line bg-surface-2 shadow-e1', className)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {lot.primaryImage && <img src={lot.primaryImage} alt={lot.title} className="size-full object-cover" />}
        <span className="absolute top-3.5 left-3.5 inline-flex h-6 items-center rounded-full bg-gradient-to-b from-gold-200 to-gold-500 px-2.5 text-[10px] font-bold tracking-[0.16em] text-ink uppercase">Winner</span>
      </div>
      <div className="flex flex-col gap-5 p-7">
        <div>
          <p className="eyebrow mb-2">
            {lotNumber(lot.id)} · {lot.category?.name ?? 'Uncategorised'}
          </p>
          <p className="display text-3xl leading-[1.1]">{lot.title}</p>
          <p className="mt-2 text-[13px] text-muted">Sold by {lot.seller.username}</p>
        </div>
        <div className="flex flex-col">
          {rows.map(([label, value]) => (
            <div key={label} className="tnum flex justify-between border-t border-line py-3 text-sm">
              <span className="text-muted">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between border-t border-line-strong pt-4">
          <span className="pb-2 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Total</span>
          <span key={total} className="display gold-text flash tnum text-5xl leading-none">
            {formatMoney(total)}
          </span>
        </div>
      </div>
    </aside>
  );
};

const CheckoutLot = ({ lot }: { lot: WonLot }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.get<Address[]>('/me/addresses') });
  const options = useQuery({ queryKey: ['delivery-options'], queryFn: () => api.get<DeliveryOption[]>('/me/delivery-options') });
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState<number>();
  const [deliveryKey, setDeliveryKey] = useState<DeliveryOption['key']>('standard');
  const [card, setCard] = useState(() => emptyCard(user?.fullName ?? ''));
  const [showErrors, setShowErrors] = useState(false);
  const [payment, setPayment] = useState<Payment>();
  const pay = useMutation({
    mutationFn: (body: { addressId: number; delivery: DeliveryOption['key']; payment: Payment }) => api.post(`/me/won/${lot.id}/checkout`, body),
    onSuccess: () => {
      toast('success', 'Payment received.');
      return queryClient.invalidateQueries();
    },
    onError: error => toast('error', error.message),
  });

  if (addresses.isPending || options.isPending) return <Spinner />;
  if (addresses.error || options.error) return <ErrorState message={(addresses.error ?? options.error)?.message ?? 'Could not load checkout.'} />;

  const address = addresses.data.find(entry => entry.id === addressId) ?? addresses.data[0];
  const delivery = options.data.find(option => option.key === deliveryKey) ?? options.data[0];
  const lastStep = stepLabels.length - 1;
  const goTo = (target: number) => {
    setStep(target);
    pay.reset();
  };

  const next = () => {
    if (step === 1) {
      const brand = cardBrand(card.number);
      if (!brand || Object.keys(cardErrors(card)).length) return setShowErrors(true);
      setPayment({ brand, last4: cardLast4(card.number) });
    }
    if (step < lastStep) return goTo(step + 1);
    if (address && payment) pay.mutate({ addressId: address.id, delivery: delivery.key, payment });
  };

  const reviewRows = [
    { label: 'Ship to', value: address ? formatAddress(address) : '', target: 0 },
    { label: 'Delivery', value: `${delivery.label} · ${delivery.detail.split(',')[0]} · ${formatMoney(delivery.cost)}`, target: 0 },
    { label: 'Payment', value: payment ? `${payment.brand} ending ${payment.last4}` : '', target: 1 },
  ];
  const total = lot.currentPrice + delivery.cost;

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
      <div className="flex min-w-0 flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <p className="eyebrow">
            {lotNumber(lot.id)} · Won {formatShortDate(lot.endDate)}
          </p>
          <h1 className="display text-5xl leading-none md:text-7xl">Secure your lot.</h1>
        </div>
        <Summary lot={lot} delivery={delivery} className="lg:hidden" />
        <ol className="flex border-t border-line">
          {stepLabels.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex-1">
                <button onClick={() => goTo(index)} disabled={index > step} aria-current={current ? 'step' : undefined} className={cx('-mt-px flex w-full items-center gap-3 border-t pt-4 text-left transition disabled:cursor-default', done || current ? 'border-gold-300' : 'border-line', current ? 'text-text' : done ? 'text-text-2' : 'text-muted')}>
                  <span className={cx('tnum grid size-7 place-items-center rounded-full border text-xs font-bold', done ? 'border-gold-300 bg-gold-300 text-ink' : current ? 'border-gold-300 text-gold-300' : 'border-white/18')}>{done ? <Icon name="check" size={13} strokeWidth={2.4} /> : index + 1}</span>
                  <span className={cx('hidden text-sm sm:inline', current && 'font-semibold')}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div key={step} className="rise">
          <p className="mb-3 text-[10.5px] font-semibold tracking-[0.22em] text-muted uppercase sm:hidden">Step {step + 1} of {stepLabels.length}</p>
          <h2 className="display mb-6 text-4xl sm:hidden">{stepTitles[step]}</h2>
          {step === 0 && <ShippingStep addresses={addresses.data} addressId={address?.id} onAddress={setAddressId} options={options.data} deliveryKey={delivery.key} onDelivery={setDeliveryKey} />}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h2 className="display text-3xl">Pay with card</h2>
              <CardForm values={card} onChange={setCard} showErrors={showErrors} />
              <p className="flex items-start gap-2.5 border border-gold-300/25 bg-gold-300/5 px-4 py-3 text-[13px] leading-normal text-text-2">
                <Icon name="shield" size={16} className="mt-0.5 flex-none text-gold-300" />
                <span>
                  <b className="font-semibold text-text">Demo payment.</b> No card is charged. Only the card brand and the last 4 digits are sent to BidNest; the full number, expiry and security code never leave this page. Saved cards and bank transfer are not available yet.
                </span>
              </p>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-7">
              <h2 className="display text-3xl">Review and pay</h2>
              <dl className="flex flex-col border-t border-line">
                {reviewRows.map(row => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-5 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                    <dt className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">{row.label}</dt>
                    <dd className="col-span-2 row-start-2 text-[15px] leading-normal sm:col-span-1 sm:row-start-1">{row.value}</dd>
                    <button onClick={() => goTo(row.target)} className="col-start-2 row-start-1 min-h-11 text-[13px] font-medium text-gold-300 sm:col-start-3">
                      Change
                    </button>
                  </div>
                ))}
              </dl>
              <p className="text-[13px] leading-relaxed text-muted">By paying you confirm the purchase of {lotNumber(lot.id)}. This is a demo checkout, so no money moves.</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-8">
          <Button variant="ghost" size="lg" disabled={step === 0 || pay.isPending} onClick={() => goTo(step - 1)}>
            <Icon name="back" size={16} />
            Back
          </Button>
          <Button variant={step === lastStep ? 'gold' : 'primary'} size="lg" className="tnum" disabled={pay.isPending || (step === 0 && !address)} onClick={next}>
            {pay.isPending && <span className="size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}
            {pay.isPending ? 'Processing payment…' : step === lastStep ? `Pay ${formatMoney(total)}` : `Continue to ${stepLabels[step + 1].toLowerCase()}`}
          </Button>
        </div>
      </div>
      <Summary lot={lot} delivery={delivery} className="hidden lg:sticky lg:top-24 lg:flex" />
    </div>
  );
};

const CheckoutPage = ({ itemId }: { itemId: number }) => {
  const won = useQuery({ queryKey: ['won'], queryFn: () => api.get<WonLot[]>('/me/won') });
  const lot = won.data?.find(item => item.id === itemId);

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-5">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-text-2 uppercase">
          <Icon name="lock" size={14} className="text-gold-300" />
          Secure checkout
        </span>
        <Link href="/dashboard/won" className="inline-flex items-center gap-2 text-[13px] text-text-2 transition hover:text-gold-300">
          <Icon name="back" size={15} />
          Back to dashboard
        </Link>
      </div>
      {won.isPending && <Spinner />}
      {won.error && <ErrorState message={won.error.message} />}
      {won.data && !lot && <EmptyState title="We couldn't find that lot" hint="Only the winner of an auction can check out." action={<LinkButton href="/dashboard/won">Back to won items</LinkButton>} />}
      {lot && (lot.paid ? <Receipt lot={lot} /> : <CheckoutLot lot={lot} />)}
    </>
  );
};

export const Checkout = ({ itemId }: { itemId: number }) => (
  <RequireAuth>
    <CheckoutPage itemId={itemId} />
  </RequireAuth>
);
