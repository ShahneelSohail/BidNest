'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { api, withQuery } from '../lib/api';
import { formatMonthYear, type AdminItem, type AdminItemDetail } from '../lib/admin';
import { formatMoney } from '../lib/format';
import { Ago, Async, Avatar, Icon, Pill, useAdminMutation } from './admin';
import { lotNumber } from './ItemCard';
import { Button, cx, EmptyState, Eyebrow, Skeleton } from './ui';

const QUEUE_PAGE_SIZE = 60;
const DAY_MS = 86_400_000;
const REJECT_REASONS = ['Stock or copied photos', 'Counterfeit risk', 'Misleading description', 'Missing condition details', 'Prohibited item', 'Price manipulation'];
const HOTKEYS = [
  ['A', 'approve'],
  ['R', 'reject'],
  ['J', 'next'],
  ['K', 'previous'],
  ['← →', 'photos'],
] as const;

const useHotkeys = (handlers: Record<string, () => void>) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey || (target instanceof HTMLElement && target.matches('input, textarea, select'))) return;
      handlers[event.key]?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
};

const Thumb = ({ src, className }: { src: string | null; className: string }) =>
  src ? <img src={src} alt="" className={cx('shrink-0 object-cover', className)} /> : <span className={cx('shrink-0 bg-surface-2', className)} />;

const Gallery = ({ images, lot }: { images: AdminItemDetail['images']; lot: string }) => {
  const [index, setIndex] = useState(0);
  const step = (delta: number) => images.length > 1 && setIndex(current => (current + delta + images.length) % images.length);
  useHotkeys({ ArrowRight: () => step(1), ArrowLeft: () => step(-1) });

  if (images.length === 0) return <div className="grid aspect-[4/5] place-items-center bg-surface-2 text-sm text-muted">No photos</div>;
  const circle = 'grid size-10 place-items-center rounded-full bg-ink/70 text-text transition hover:bg-ink';
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        <img key={images[index].id} src={images[index].url} alt={lot} className="rise size-full object-cover" />
        <span className="absolute top-3.5 left-3.5 bg-ink/70 px-2 py-1 text-[10.5px] font-semibold tracking-[0.22em] text-gold-300 uppercase">{lot}</span>
        <div className="absolute inset-x-3.5 bottom-3.5 flex items-center justify-between">
          <button onClick={() => step(-1)} aria-label="Previous photo" className={circle}>
            <Icon name="prev" />
          </button>
          <span className="tnum rounded-full bg-ink/70 px-2.5 py-1 text-xs">
            {index + 1} / {images.length}
          </span>
          <button onClick={() => step(1)} aria-label="Next photo" className={circle}>
            <Icon name="next" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((image, position) => (
          <button key={image.id} onClick={() => setIndex(position)} aria-label={`Photo ${position + 1}`} className={cx('size-[72px] overflow-hidden border bg-surface-2 transition hover:opacity-100', position === index ? 'border-gold-300' : 'border-line opacity-60')}>
            <Thumb src={image.url} className="size-full" />
          </button>
        ))}
      </div>
    </div>
  );
};

const Fact = ({ label, value, gold }: { label: string; value: string; gold?: boolean }) => (
  <div className="border-b border-line-neutral py-2.5">
    <dt className="text-[11px] text-muted">{label}</dt>
    <dd className={cx('mt-1', gold ? 'display text-2xl text-gold-300' : 'text-[15px]')}>{value}</dd>
  </div>
);

const Review = ({ item, position, total, onStep, onDecided }: { item: AdminItem; position: number; total: number; onStep: (delta: number) => void; onDecided: () => void }) => {
  const detail = useQuery({ queryKey: ['admin', 'item', item.id], queryFn: () => api.get<AdminItemDetail>(`/admin/items/${item.id}`) });
  const [rejecting, setRejecting] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const lot = lotNumber(item.id);
  const days = Math.max(1, Math.round((Date.parse(item.endDate) - Date.parse(item.startDate)) / DAY_MS));
  const duration = `${days} day${days === 1 ? '' : 's'}`;
  const rejectionReason = [reasons.join(', '), note.trim()].filter(Boolean).join('. ');

  const undo = () => api.post(`/admin/approvals/${item.id}/undo`);
  const approve = useAdminMutation(() => api.post(`/admin/approvals/${item.id}/approve`, {}), `${lot} approved. The seller has been notified.`, undo);
  const reject = useAdminMutation((reason: string) => api.post(`/admin/approvals/${item.id}/reject`, { rejectionReason: reason }), `${lot} sent back to the seller.`, undo);
  const busy = approve.isPending || reject.isPending;

  const approveNow = () => !busy && approve.mutate(undefined, { onSuccess: onDecided });
  const submitRejection = (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (!rejectionReason) return setTouched(true);
    reject.mutate(rejectionReason, { onSuccess: onDecided });
  };
  useHotkeys({ a: approveNow, r: () => setRejecting(true), j: () => onStep(1), k: () => onStep(-1) });

  const toggleReason = (reason: string) => setReasons(current => (current.includes(reason) ? current.filter(entry => entry !== reason) : [...current, reason]));
  const facts = [
    { label: 'Opening bid', value: formatMoney(item.minBid), gold: true },
    { label: 'Bid increment', value: formatMoney(item.bidIncrement) },
    { label: 'Condition', value: item.condition ?? 'Not stated' },
    { label: 'Duration', value: duration },
  ];

  return (
    <div className="rise flex min-w-0 flex-col gap-8">
      <div className="grid items-start gap-9 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {detail.data ? <Gallery images={detail.data.images} lot={lot} /> : <Skeleton className="aspect-[4/5]" />}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <Pill tone="warn">Pending review</Pill>
            <span className="text-xs text-muted">
              {position} of {total} · submitted <Ago at={item.createdAt} /> ago
            </span>
          </div>
          <div>
            <Eyebrow className="mb-2.5">
              {lot} · {item.category?.name ?? 'Uncategorised'}
            </Eyebrow>
            <h2 className="display text-4xl leading-[1.04] md:text-[44px]">{item.title}</h2>
          </div>
          <div className="flex items-center gap-3 border-y border-line py-3.5">
            <Avatar name={item.seller.username} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">@{item.seller.username}</p>
              <p className="text-[12.5px] text-muted">{detail.data ? `Joined ${formatMonthYear(detail.data.seller.createdAt)}` : 'Loading seller'}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-7">
            {facts.map(fact => (
              <Fact key={fact.label} {...fact} />
            ))}
          </dl>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-text-2">{item.description || 'No description provided.'}</p>
          {item.rejectionReason && (
            <p className="border border-outbid/30 bg-outbid/5 px-3 py-2.5 text-[13px] leading-normal">
              <span className="text-outbid">Earlier feedback: </span>
              {item.rejectionReason}
            </p>
          )}
        </div>
      </div>
      <div className="sticky bottom-6 flex flex-col gap-4 rounded-xs border border-line-strong bg-surface-2 px-6 py-5 shadow-e3">
        {rejecting ? (
          <form onSubmit={submitRejection} className="rise flex flex-col gap-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="display text-2xl">Send back to {item.seller.username}</p>
              <span className="text-xs text-muted">Choose a reason or write a note</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map(reason => (
                <button key={reason} type="button" aria-pressed={reasons.includes(reason)} onClick={() => toggleReason(reason)} className={cx('h-[38px] rounded-full border px-3.5 text-[13px] font-medium transition', reasons.includes(reason) ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-line-strong text-text-2 hover:border-gold-300')}>
                  {reason}
                </button>
              ))}
            </div>
            {touched && !rejectionReason && (
              <span role="alert" className="text-[13px] text-danger">
                Pick a reason so the seller knows what to fix.
              </span>
            )}
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Note to the seller (shown with the reasons). Be specific about what to change."
              className="h-21 resize-none rounded-sm border border-line-strong bg-surface px-3.5 py-3 text-sm leading-relaxed text-text outline-none transition placeholder:text-muted focus:border-gold-300"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={busy}>
                Send back to seller
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-60 flex-1 text-sm text-text-2">Approving makes the lot live for {duration} and notifies the seller.</p>
            <Button variant="danger" onClick={() => setRejecting(true)}>
              Reject or request changes
            </Button>
            <Button variant="gold" disabled={busy} onClick={approveNow}>
              <Icon name="check" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const Kbd = ({ children }: { children: string }) => <span className="rounded-[3px] border border-white/12 px-1.5 py-px text-text-2">{children}</span>;

const Queue = ({ items, total }: { items: AdminItem[]; total: number }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const index = Math.max(0, items.findIndex(item => item.id === selectedId));
  const selected = items[index];

  const onStep = (delta: number) => items[index + delta] && setSelectedId(items[index + delta].id);
  const onDecided = () => setSelectedId((items[index + 1] ?? items[index - 1])?.id ?? null);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="top-6 flex flex-col lg:sticky">
        <div className="flex items-baseline justify-between border-b border-line-strong pb-3.5">
          <h1 className="display text-4xl">Approvals</h1>
          <span className="tnum text-xs text-muted">{total} waiting</span>
        </div>
        {items.map(item => (
          <button key={item.id} onClick={() => setSelectedId(item.id)} aria-current={item.id === selected.id} className={cx('grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3.5 border-b border-l-2 border-b-line-neutral px-3 py-3.5 text-left transition hover:bg-surface-2', item.id === selected.id ? 'border-l-gold-300 bg-surface-2' : 'border-l-transparent')}>
            <Thumb src={item.primaryImage} className="size-14" />
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-sm font-medium">{item.title}</span>
              <span className="flex items-center gap-2 text-[11.5px] text-muted">
                {lotNumber(item.id)} · <Ago at={item.createdAt} />
              </span>
            </span>
          </button>
        ))}
        <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs text-muted">
          {HOTKEYS.map(([key, action]) => (
            <span key={key} className="flex items-center gap-1.5">
              <Kbd>{key}</Kbd> {action}
            </span>
          ))}
        </p>
      </div>
      <Review key={selected.id} item={selected} position={index + 1} total={items.length} onStep={onStep} onDecided={onDecided} />
    </div>
  );
};

export const Approvals = () => {
  const queue = useQuery({ queryKey: ['admin', 'approvals', 'queue'], queryFn: () => api.page<AdminItem>(withQuery('/admin/approvals', { pageSize: QUEUE_PAGE_SIZE })) });
  return (
    <Async query={queue}>
      {({ items, meta }) => (items.length === 0 ? <EmptyState title="The queue is clear." hint="New submissions appear here as they arrive." /> : <Queue items={items} total={meta.total} />)}
    </Async>
  );
};
