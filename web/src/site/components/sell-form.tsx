'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { autoIncrement, CONDITIONS, DURATIONS, durationDaysOf, INCREMENT_PRESETS, invalidateSeller, MIN_PHOTOS, useSellerItem, type Increment } from '../lib/seller';
import type { Category, ItemDetail } from '../lib/types';
import { lotNumber } from './ItemCard';
import { useToast } from './Providers';
import { FieldError, FieldLabel, PhotoPicker, PillRadio, ChoiceChips, type Photo } from './sell-form-fields';
import { Icon } from './sell-icons';
import { Button, cx, EmptyState, ErrorState, Eyebrow, LinkButton, Spinner } from './ui';

type Condition = (typeof CONDITIONS)[number];
type Mode = 'new' | 'edit';

interface Draft {
  title: string;
  categoryId: number | null;
  condition: Condition | '';
  description: string;
  photos: Photo[];
  openingBid: number;
  increment: Increment;
  durationDays: number;
  confirmed: boolean;
}

const MIN_DRAFT_TITLE = 5;
const STEPS = ['Details', 'Photos', 'Pricing & duration', 'Review'];
const LAST_STEP = STEPS.length - 1;
const TITLE_MIN = 10;
const TITLE_MAX = 80;
const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 4000;
const MAX_OPENING_BID = 999_999;
const BID_STEP = 50;
const DEFAULT_DURATION = 7;
const UNDERLINE = 'border-0 border-b bg-transparent outline-none transition focus:border-gold-300 focus:shadow-[0_1px_0_var(--color-gold-300)]';
const BOX = 'border bg-surface outline-none transition focus-within:border-gold-300 focus-within:shadow-[0_0_0_3px_rgba(231,211,147,0.15)]';

const emptyDraft: Draft = { title: '', categoryId: null, condition: '', description: '', photos: [], openingBid: 100, increment: 'auto', durationDays: DEFAULT_DURATION, confirmed: false };

const draftFromItem = (item: ItemDetail, mode: Mode): Draft => ({
  title: item.title,
  categoryId: item.categoryId ?? item.category?.id ?? null,
  condition: CONDITIONS.find(condition => condition === item.condition) ?? '',
  description: item.description,
  photos: [...item.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map(image => ({ key: `image-${image.id}`, src: image.url, existingId: mode === 'edit' ? image.id : undefined })),
  openingBid: item.minBid,
  increment: item.bidIncrement === autoIncrement(item.minBid) ? 'auto' : (INCREMENT_PRESETS.find(preset => preset === item.bidIncrement) ?? 'auto'),
  durationDays: mode === 'edit' ? durationDaysOf(item) : (DURATIONS.find(days => days === durationDaysOf(item)) ?? DEFAULT_DURATION),
  confirmed: false,
});

const errorsFor = (step: number, draft: Draft): Partial<Record<'title' | 'category' | 'condition' | 'description' | 'photos' | 'opening' | 'confirmed', string>> => {
  const description = draft.description.trim().length;
  switch (step) {
    case 0:
      return {
        title: draft.title.trim().length < TITLE_MIN ? (draft.title ? `Use at least ${TITLE_MIN} characters so buyers can find it` : 'Give the lot a title') : draft.title.length > TITLE_MAX ? `Keep it under ${TITLE_MAX} characters` : undefined,
        category: draft.categoryId === null ? 'Choose a category' : undefined,
        condition: draft.condition ? undefined : 'Choose a condition',
        description: description < DESCRIPTION_MIN ? `Describe condition and provenance (${DESCRIPTION_MIN - description} more characters)` : undefined,
      };
    case 1:
      return { photos: draft.photos.length < MIN_PHOTOS ? `Add at least ${MIN_PHOTOS} photos (${draft.photos.length} of ${MIN_PHOTOS})` : undefined };
    case 2:
      return { opening: draft.openingBid >= 1 ? undefined : 'Opening bid must be at least $1' };
    default:
      return { confirmed: draft.confirmed ? undefined : 'Confirm the declaration to submit' };
  }
};

const hasErrors = (errors: object) => Object.values(errors).some(Boolean);

const photoFile = async (photo: Photo): Promise<File> => {
  if (photo.file) return photo.file;
  const blob = await (await fetch(photo.src)).blob();
  return new File([blob], photo.src.split('/').pop() ?? 'photo.jpg', { type: blob.type });
};

const Stepper = ({ step, onGo }: { step: number; onGo: (step: number) => void }) => (
  <ol className="hidden lg:flex">
    {STEPS.map((label, index) => {
      const done = index < step;
      const current = index === step;
      return (
        <li key={label} className="flex-1">
          <button
            type="button"
            disabled={index > step}
            onClick={() => onGo(index)}
            className={cx('flex w-full items-center gap-3 border-t pt-4 text-left transition', done || current ? 'border-gold-300' : 'border-line', current ? 'text-text' : done ? 'text-text-2' : 'text-muted', index <= step ? 'cursor-pointer' : 'cursor-default')}
          >
            <span className={cx('grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold', done ? 'border-gold-300 bg-gold-300 text-ink' : current ? 'border-gold-300 text-gold-300' : 'border-white/20 text-muted')}>{done ? <Icon name="check" size={13} strokeWidth={2.5} /> : index + 1}</span>
            <span className={cx('text-sm', current && 'font-semibold')}>{label}</span>
          </button>
        </li>
      );
    })}
  </ol>
);

const PreviewCard = ({ draft, categoryName, lot }: { draft: Draft; categoryName?: string; lot: string }) => (
  <div className="flex flex-col gap-4">
    <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface-2">
      {draft.photos[0] ? (
        <img src={draft.photos[0].src} alt="" className="size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-muted/70">
          <Icon name="image" size={28} strokeWidth={1.25} />
          <span className="text-xs">Cover photo</span>
        </div>
      )}
      <span className="absolute top-3 left-3 bg-ink/70 px-2 py-[5px] text-[10.5px] font-semibold tracking-[0.22em] text-gold-300 uppercase">{lot}</span>
    </div>
    <div className="flex flex-col gap-2">
      <p className="eyebrow text-muted!">
        {categoryName ?? 'Category'} · {draft.condition || '—'}
      </p>
      <h3 className={cx('display line-clamp-2 text-2xl leading-[1.15]', !draft.title && 'text-muted/70')}>{draft.title || 'Your lot title appears here'}</h3>
    </div>
    <div className="flex items-end justify-between border-t border-line pt-3">
      <div>
        <p className="mb-0.5 text-[10px] tracking-[0.2em] text-muted uppercase">Opening bid</p>
        <p className="display gold-text tnum text-2xl">{formatMoney(draft.openingBid)}</p>
      </div>
      <div className="tnum text-right text-xs text-muted">
        <p>0 bids</p>
        <p className="mt-0.5 text-text">{draft.durationDays}d 0h 00m</p>
      </div>
    </div>
  </div>
);

const Section = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3">
    <FieldLabel>{label}</FieldLabel>
    {children}
    <FieldError message={error} />
  </div>
);

const DetailsStep = ({ draft, patch, errors, categories }: StepProps & { categories: Category[] }) => {
  const categoryOptions = categories.flatMap(root => (root.children?.length ? root.children : [root])).map(category => ({ key: category.id, label: category.name }));
  return (
    <div className="flex flex-col gap-9">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between">
          <FieldLabel>Lot title</FieldLabel>
          <span className={cx('tnum text-xs', draft.title.length > TITLE_MAX ? 'text-danger' : 'text-muted')}>
            {draft.title.length} / {TITLE_MAX}
          </span>
        </span>
        <input
          value={draft.title}
          onChange={event => patch({ title: event.target.value })}
          placeholder="Maker, model, year. e.g. Leica M6 TTL 0.72, 1998"
          aria-invalid={!!errors.title}
          className={cx(UNDERLINE, 'display h-[52px] text-[22px] text-text md:h-[60px] md:text-3xl', errors.title ? 'border-danger' : draft.title ? 'border-gold-300/45' : 'border-line-strong')}
        />
        <FieldError message={errors.title} />
      </label>
      <Section label="Category" error={errors.category}>
        <ChoiceChips options={categoryOptions} value={draft.categoryId} onChange={categoryId => patch({ categoryId })} />
      </Section>
      <Section label="Condition" error={errors.condition}>
        <PillRadio options={CONDITIONS.map(condition => ({ key: condition, label: condition }))} value={draft.condition} onChange={condition => patch({ condition })} invalid={!!errors.condition} />
      </Section>
      <label className="flex flex-col gap-2">
        <span className="flex justify-between">
          <FieldLabel>Description</FieldLabel>
          <span className="tnum text-xs text-muted">
            {draft.description.length} / {DESCRIPTION_MAX.toLocaleString('en-US')}
          </span>
        </span>
        <textarea
          value={draft.description}
          onChange={event => patch({ description: event.target.value })}
          maxLength={DESCRIPTION_MAX}
          placeholder="Condition, service history, provenance, what's included. Mention any flaws visible in the photos."
          aria-invalid={!!errors.description}
          className={cx(BOX, 'h-36 resize-y rounded-sm px-4 py-3.5 text-[15px] leading-[1.65] text-text md:h-[168px]', errors.description ? 'border-danger' : 'border-line-strong')}
        />
        <FieldError message={errors.description} />
      </label>
    </div>
  );
};

const photoTips = [
  ['I.', 'Daylight, plain ground', 'Natural light on a plain background shows true colour.'],
  ['II.', 'Serials and hallmarks', 'One close-up of every mark that proves age or origin.'],
  ['III.', 'Show the flaws', 'Disclosed wear is the main defence in a dispute.'],
];

const PhotosStep = ({ draft, patch, errors }: StepProps) => (
  <div className="flex flex-col gap-5">
    <PhotoPicker photos={draft.photos} onChange={photos => patch({ photos })} error={errors.photos} />
    <div className="grid gap-6 border-t border-line pt-5 md:grid-cols-3">
      {photoTips.map(([numeral, title, text]) => (
        <div key={numeral}>
          <p className="display mb-1 text-lg text-gold-300">{numeral}</p>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-[13px] leading-normal text-muted">{text}</p>
        </div>
      ))}
    </div>
  </div>
);

const PricingStep = ({ draft, patch, errors, mode }: StepProps & { mode: Mode }) => {
  const stepper = 'grid w-11 place-items-center border-l border-line text-text-2 transition hover:bg-surface-2 hover:text-gold-300 md:w-[52px]';
  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-col gap-2">
        <FieldLabel>Opening bid</FieldLabel>
        <div className={cx(BOX, 'flex h-14 items-stretch overflow-hidden rounded-sm md:h-16', errors.opening ? 'border-danger' : 'border-line-strong')}>
          <span className="display flex items-center border-r border-line px-4 text-[26px] text-muted">$</span>
          <input
            value={draft.openingBid ? draft.openingBid.toLocaleString('en-US') : ''}
            onChange={event => patch({ openingBid: Number(event.target.value.replace(/\D/g, '').slice(0, 6)) })}
            inputMode="numeric"
            aria-label="Opening bid"
            className="display tnum min-w-0 flex-1 bg-transparent px-4 text-2xl text-text outline-none md:text-3xl"
          />
          {([['Decrease by $50', 'M5 12h14', -BID_STEP], ['Increase by $50', 'M5 12h14M12 5v14', BID_STEP]] as const).map(([label, path, delta]) => (
            <button key={label} type="button" aria-label={label} className={stepper} onClick={() => patch({ openingBid: Math.min(MAX_OPENING_BID, Math.max(0, draft.openingBid + delta)) })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <path d={path} />
              </svg>
            </button>
          ))}
        </div>
        <FieldError message={errors.opening} />
      </div>
      <Section label="Bid increment">
        <PillRadio
          options={[{ key: 'auto' as Increment, label: `Auto · ${formatMoney(autoIncrement(draft.openingBid))}` }, ...INCREMENT_PRESETS.map(preset => ({ key: preset as Increment, label: `$${preset}` }))]}
          value={draft.increment}
          onChange={increment => patch({ increment })}
        />
      </Section>
      <Section label="Duration">
        {mode === 'new' ? (
          <ChoiceChips options={DURATIONS.map(days => ({ key: days, label: `${days} days`, badge: days === DEFAULT_DURATION ? 'Most bids' : undefined }))} value={draft.durationDays} onChange={durationDays => patch({ durationDays })} />
        ) : (
          <p className="text-sm text-text-2">This listing runs for {draft.durationDays} days. The duration is fixed once a listing is submitted.</p>
        )}
      </Section>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border border-line bg-surface-2 p-3 lg:hidden">
        {draft.photos[0] ? <img src={draft.photos[0].src} alt="" className="h-[90px] w-[72px] object-cover" /> : <span className="h-[90px] w-[72px] border border-dashed border-line-strong" />}
        <div>
          <Eyebrow className="text-muted!">Preview · {draft.durationDays}d</Eyebrow>
          <p className={cx('display my-1 line-clamp-2 text-[17px] leading-[1.15]', !draft.title && 'text-muted/70')}>{draft.title || 'Your lot title appears here'}</p>
          <p className="display text-xl text-gold-300">{formatMoney(draft.openingBid)}</p>
        </div>
      </div>
    </div>
  );
};

const ReviewStep = ({ draft, patch, errors, mode, categoryName, onGo }: StepProps & { mode: Mode; categoryName?: string; onGo: (step: number) => void }) => {
  const rows = [
    { label: 'Details', value: `${draft.title} · ${categoryName ?? '—'} · ${draft.condition}`, step: 0 },
    { label: 'Photos', value: `${draft.photos.length} photos · cover set`, step: 1 },
    { label: 'Pricing', value: `Opens at ${formatMoney(draft.openingBid)} · ${formatMoney(draft.increment === 'auto' ? autoIncrement(draft.openingBid) : draft.increment)} increments`, step: 2 },
    { label: 'Duration', value: `${draft.durationDays} days · starts on approval`, step: mode === 'new' ? 2 : undefined },
  ];
  return (
    <div className="flex flex-col gap-7">
      <div className="flex gap-2.5 overflow-x-auto">
        {draft.photos.slice(0, 6).map(photo => (
          <img key={photo.key} src={photo.src} alt="" className="h-[110px] w-[88px] shrink-0 object-cover" />
        ))}
      </div>
      <dl className="flex flex-col border-t border-line">
        {rows.map(row => (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4 md:grid-cols-[140px_minmax(0,1fr)_auto]">
            <dt className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">{row.label}</dt>
            <dd className="col-start-1 text-[15px] leading-normal md:col-start-auto">{row.value}</dd>
            {row.step !== undefined && (
              <button type="button" onClick={() => onGo(row.step!)} className="col-start-2 row-span-2 row-start-1 min-h-11 self-center text-[13px] font-medium text-gold-300 md:col-start-auto md:row-span-1 md:row-start-auto">
                Change
              </button>
            )}
          </div>
        ))}
      </dl>
      <button type="button" role="checkbox" aria-checked={draft.confirmed} onClick={() => patch({ confirmed: !draft.confirmed })} className="flex min-h-11 items-start gap-3.5 text-left text-sm leading-relaxed text-text-2">
        <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-xs border text-ink transition', errors.confirmed ? 'border-danger' : draft.confirmed ? 'border-gold-300 bg-gold-300' : 'border-gold-300/40')}>{draft.confirmed && <Icon name="check" size={13} strokeWidth={2.5} />}</span>
        I confirm this item is as described, is mine to sell, and that the photos are my own.
      </button>
      <FieldError message={errors.confirmed} />
    </div>
  );
};

interface StepProps {
  draft: Draft;
  patch: (changes: Partial<Draft>) => void;
  errors: ReturnType<typeof errorsFor>;
}

const doneCopy: Record<Mode, { title: string; text: string }> = {
  new: { title: 'Submitted for review.', text: 'An admin checks every lot before it goes live. You’ll get a notification either way.' },
  edit: { title: 'Changes saved.', text: 'An admin reviews the update before the listing goes live.' },
};

const Done = ({ mode, lot, title, days, onAnother }: { mode: Mode; lot: string; title: string; days: number; onAnother?: () => void }) => {
  const steps = [
    { label: 'Submitted', sub: 'Just now', tone: 'done' },
    { label: 'Admin review', sub: 'Before it goes live', tone: 'current' },
    { label: `Live for ${days} days`, sub: 'Starts on approval', tone: 'next' },
  ] as const;
  const toneClass = { done: 'border-gold-300', current: 'border-info', next: 'border-white/20' };
  return (
    <div className="rise mx-auto mt-10 flex max-w-[720px] flex-col items-start gap-6">
      <svg width="88" height="88" viewBox="0 0 72 72" fill="none" aria-hidden>
        <circle cx="36" cy="36" r="34" stroke="#e7d393" strokeWidth="1.2" strokeDasharray="214" strokeDashoffset="214" style={{ animation: 'draw .8s cubic-bezier(.65,0,.35,1) forwards' }} />
        <path d="M23 37l9 9 17-19" stroke="#e7d393" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'draw .5s cubic-bezier(.16,1,.3,1) .6s forwards' }} />
      </svg>
      <Eyebrow>
        {lot} · {title}
      </Eyebrow>
      <h1 className="display text-6xl md:text-[80px] md:leading-none">{doneCopy[mode].title}</h1>
      <p className="text-base leading-relaxed text-text-2">{doneCopy[mode].text}</p>
      <div className="flex w-full pt-4">
        {steps.map((step, index) => (
          <div key={step.label} className={cx('flex flex-1 flex-col gap-2.5 border-t pt-4', toneClass[step.tone])}>
            <span className={cx('grid size-7 place-items-center rounded-full border text-xs font-bold', toneClass[step.tone], step.tone === 'done' ? 'bg-gold-300 text-ink' : step.tone === 'current' ? 'text-info' : 'text-muted')}>{step.tone === 'done' ? <Icon name="check" size={13} strokeWidth={2.5} /> : index + 1}</span>
            <span className={cx('text-[15px] font-semibold', step.tone === 'next' && 'text-muted')}>{step.label}</span>
            <span className="text-[13px] text-muted">{step.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5 pt-2">
        <LinkButton href="/sell?status=pending" size="lg">
          Back to listings
        </LinkButton>
        {onAnother && (
          <Button variant="ghost" size="lg" onClick={onAnother}>
            List another
          </Button>
        )}
      </div>
    </div>
  );
};

const Wizard = ({ mode, source, categories, onAnother }: { mode: Mode; source?: ItemDetail; categories: Category[]; onAnother?: () => void }) => {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDraftSource = source?.status === 'draft';
  const [draft, setDraft] = useState<Draft>(() => (source ? draftFromItem(source, mode) : emptyDraft));
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState<ItemDetail | null>(null);
  const patch = (changes: Partial<Draft>) => setDraft(current => ({ ...current, ...changes }));
  const errors = touched ? errorsFor(step, draft) : {};
  const categoryName = categories.flatMap(root => [root, ...(root.children ?? [])]).find(category => category.id === draft.categoryId)?.name;
  const go = (next: number) => {
    setStep(next);
    setTouched(false);
  };

  const submit = useMutation({
    mutationFn: async (asDraft: boolean) => {
      const original = source ? [...source.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)) : [];
      const photosUnchanged = mode === 'edit' && draft.photos.length === original.length && draft.photos.every((photo, index) => photo.existingId === original[index]?.id);
      const fields: Record<string, string> = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        ...(draft.categoryId !== null && { categoryId: String(draft.categoryId) }),
        ...(draft.condition && { condition: draft.condition }),
        minBid: String(draft.openingBid),
        increment: String(draft.increment),
        ...(mode === 'new' && { durationDays: String(draft.durationDays), draft: String(asDraft) }),
      };
      const form = new FormData();
      Object.entries(fields).forEach(([name, value]) => form.append(name, value));
      if (!photosUnchanged) {
        original.forEach(image => form.append('removeImageIds', String(image.id)));
        (await Promise.all(draft.photos.map(photoFile))).forEach(file => form.append('images', file));
      }
      const result = mode === 'edit' ? await api.patch<ItemDetail>(`/seller/items/${source!.id}`, form) : await api.post<ItemDetail>('/seller/items', form);
      return !asDraft && isDraftSource ? api.post<ItemDetail>(`/seller/items/${result.id}/submit`) : result;
    },
    onSuccess: (item, asDraft) => {
      void invalidateSeller(queryClient);
      if (asDraft) {
        toast('success', 'Draft saved.');
        router.push('/sell?status=draft');
        return;
      }
      toast('success', mode === 'edit' && !isDraftSource ? 'Listing updated.' : 'Listing submitted for approval.');
      setSaved(item);
    },
  });

  if (saved) return <Done mode={isDraftSource ? 'new' : mode} lot={lotNumber(saved.id)} title={saved.title} days={draft.durationDays} onAnother={onAnother} />;

  const next = () => {
    if (hasErrors(errorsFor(step, draft))) return setTouched(true);
    if (step < LAST_STEP) return go(step + 1);
    submit.mutate(false);
  };
  const saveDraft = () => {
    if (draft.title.trim().length < MIN_DRAFT_TITLE || draft.openingBid <= 0) return toast('error', `Add a title (${MIN_DRAFT_TITLE}+ characters) and an opening bid to save a draft.`);
    submit.mutate(true);
  };
  const canSaveDraft = mode === 'new' || isDraftSource;
  const nextLabel = submit.isPending ? 'Submitting…' : step === LAST_STEP ? (mode === 'edit' && !isDraftSource ? 'Save changes' : 'Submit for review') : `Continue to ${STEPS[step + 1]!.toLowerCase()}`;
  const stepProps: StepProps = { draft, patch, errors };
  const lot = source && mode === 'edit' ? lotNumber(source.id) : 'Lot new';

  return (
    <div className="grid gap-16 pb-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
      <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
        <div className="flex flex-col gap-3.5">
          <Eyebrow>{isDraftSource ? `Draft · ${lot}` : mode === 'edit' ? `Editing ${lot}` : 'New listing'}</Eyebrow>
          <h1 className="display text-5xl md:text-7xl md:leading-none">{mode === 'edit' ? 'Edit listing.' : 'List a lot.'}</h1>
        </div>
        <Stepper step={step} onGo={go} />
        <div className="lg:hidden">
          <div className="h-0.5 bg-white/10">
            <div className="h-full bg-gold-300 transition-[width] duration-[600ms] ease-[var(--ease-expo)]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <Eyebrow className="mt-3 text-muted!">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Eyebrow>
        </div>
        <div key={step} className="rise">
          {step === 0 && <DetailsStep {...stepProps} categories={categories} />}
          {step === 1 && <PhotosStep {...stepProps} />}
          {step === 2 && <PricingStep {...stepProps} mode={mode} />}
          {step === 3 && <ReviewStep {...stepProps} mode={mode} categoryName={categoryName} onGo={go} />}
        </div>
        {submit.error && <ErrorState message={submit.error.message} />}
        <div className="fixed inset-x-0 bottom-[84px] z-20 flex items-center gap-2.5 border-t border-line bg-surface/95 px-4 py-2.5 lg:static lg:justify-between lg:border-t lg:bg-transparent lg:px-0 lg:pt-7 lg:pb-0">
          <Button variant="ghost" size="lg" disabled={step === 0} onClick={() => go(step - 1)} className="border border-line lg:border-0">
            <Icon name="back" />
            Back
          </Button>
          {canSaveDraft && (
            <Button variant="secondary" size="lg" disabled={submit.isPending} onClick={saveDraft} className="lg:ml-auto">
              Save draft
            </Button>
          )}
          <Button variant={step === LAST_STEP ? 'gold' : 'primary'} size="lg" disabled={submit.isPending} onClick={next} className="flex-1 lg:flex-none">
            {submit.isPending && <span className="size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}
            {nextLabel}
          </Button>
        </div>
      </div>
      <aside className="sticky top-24 hidden flex-col gap-4 self-start lg:flex">
        <Eyebrow className="flex items-center gap-2 text-muted!">
          <span className="live-dot size-1.5 rounded-full bg-gold-300" />
          Live preview
        </Eyebrow>
        <PreviewCard draft={draft} categoryName={categoryName} lot={lot} />
        {step === 2 && <p className="text-xs text-muted">Bids rise in {formatMoney(draft.increment === 'auto' ? autoIncrement(draft.openingBid) : draft.increment)} steps.</p>}
      </aside>
    </div>
  );
};

export const ListingForm = ({ mode, sourceId }: { mode: Mode; sourceId?: number }) => {
  const [session, setSession] = useState(0);
  const source = useSellerItem(sourceId);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });

  if (sourceId !== undefined && source.isPending) return <Spinner />;
  if (source.error) return <ErrorState message={source.error.message} />;
  if (mode === 'edit' && source.data?.status !== 'pending' && source.data?.status !== 'draft') {
    return <EmptyState title="Only drafts and pending listings can be edited" hint="Once a listing has been reviewed it can no longer be changed." action={<LinkButton href="/sell">Back to listings</LinkButton>} />;
  }
  if (categories.error) return <ErrorState message={categories.error.message} />;
  if (categories.isPending) return <Spinner />;

  return <Wizard key={session} mode={mode} source={source.data} categories={categories.data} onAnother={sourceId === undefined ? () => setSession(current => current + 1) : undefined} />;
};
