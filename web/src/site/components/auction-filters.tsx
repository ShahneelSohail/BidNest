'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { cx } from './ui';

export const statusOptions = [
  { value: 'active', label: 'All' },
  { value: 'hour', label: 'Under 1 hour' },
  { value: 'today', label: 'Ending today' },
  { value: 'featured', label: 'Featured' },
];

export const sortOptions = [
  { value: 'ending', label: 'Ending soonest' },
  { value: 'newest', label: 'Newly listed' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'bids', label: 'Most bids' },
];

export const viewOptions = [
  { value: 'grid', label: 'Grid view', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { value: 'list', label: 'List view', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
] as const;

export type ViewMode = (typeof viewOptions)[number]['value'];

const pill = (on: boolean) => cx('shrink-0 rounded-full border font-medium transition', on ? 'border-gold-300 bg-gold-300/12 text-gold-300' : 'border-gold-300/20 text-text hover:border-gold-300');

const Icon = ({ path, size = 16 }: { path: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={path} />
  </svg>
);

const SearchBox = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [focused, setFocused] = useState(false);
  const debounced = useDebounced(value.trim());
  const suggestions = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: () => api.get<{ id: number; title: string }[]>(withQuery('/items/suggestions', { q: debounced })),
    enabled: focused && debounced.length > 0,
  });

  return (
    <div className="relative min-w-0 flex-1 lg:w-[340px] lg:flex-none">
      <div className={cx('flex h-11 items-center gap-2.5 rounded-full border bg-surface px-3.5 transition', focused ? 'border-gold-300' : 'border-gold-300/20')}>
        <Icon path="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search lots, makers, eras"
          aria-label="Search lots"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="grid size-6 place-items-center rounded-full bg-surface-3 text-text-2">
            <Icon path="M18 6 6 18M6 6l12 12" size={12} />
          </button>
        )}
      </div>
      {focused && suggestions.data && suggestions.data.length > 0 && (
        <div role="listbox" className="absolute top-[52px] right-0 left-0 z-10 rounded-sm border border-line bg-surface-3 p-1.5 shadow-e3">
          {suggestions.data.map(suggestion => (
            <Link key={suggestion.id} href={`/auctions/${suggestion.id}`} onMouseDown={event => event.preventDefault()} role="option" className="flex h-11 items-center gap-3 rounded-xs px-2.5 text-sm transition hover:bg-white/5">
              <span className="w-16 shrink-0 text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">Lot</span>
              <span className="truncate">{suggestion.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const SortMenu = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-9 items-center gap-2 rounded-full border border-gold-300/20 px-3.5 text-[13px] font-medium transition hover:border-gold-300">
        <span className="text-muted">Sort</span>
        {sortOptions.find(option => option.value === value)?.label}
        <Icon path="m6 9 6 6 6-6" size={14} />
      </button>
      {open && (
        <div role="menu" className="rise absolute top-11 right-0 z-10 w-[220px] rounded-sm border border-line bg-surface-3 p-1.5 shadow-e3">
          {sortOptions.map(option => (
            <button
              key={option.value}
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cx('flex h-10 w-full items-center justify-between rounded-xs px-2.5 text-left text-sm transition hover:bg-white/5', option.value === value ? 'text-gold-300' : 'text-text')}
            >
              {option.label}
              {option.value === value && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  categories: { id: number; name: string; activeItems: number }[];
  categoryId: string;
  onCategory: (id: string) => void;
  status: string;
  onStatus: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  countText: string;
  isFiltered: boolean;
  onReset: () => void;
  onOpenSheet: () => void;
}

export const FilterBar = (props: FilterBarProps) => {
  const totalActive = props.categories.reduce((sum, category) => sum + category.activeItems, 0);
  const chips = [{ id: '', name: 'All', activeItems: totalActive }, ...props.categories];

  return (
    <div className="sticky top-[72px] z-30 -mx-6 border-y border-line bg-ink/92 backdrop-blur-xl md:-mx-12">
      <div className="mx-auto flex max-w-[1560px] items-center gap-3 px-6 pt-6 pb-4 md:px-12 lg:gap-8">
        <SearchBox value={props.search} onChange={props.onSearch} />
        <div className="hidden min-w-0 flex-1 gap-3 overflow-x-auto [mask-image:linear-gradient(90deg,#000_calc(100%-48px),transparent)] [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
          {chips.map(chip => (
            <button key={chip.id} aria-pressed={String(chip.id) === props.categoryId} onClick={() => props.onCategory(String(chip.id))} className={cx(pill(String(chip.id) === props.categoryId), 'flex h-10 shrink-0 items-center gap-2 px-5 text-[13px]')}>
              {chip.name}
              <span className="text-[11px] opacity-60 tnum">{chip.activeItems}</span>
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="View" className="flex shrink-0 rounded-full border border-line p-[3px]">
          {viewOptions.map(option => (
            <button key={option.value} role="radio" aria-checked={option.value === props.view} aria-label={option.label} onClick={() => props.onView(option.value)} className={cx('grid h-[34px] w-10 place-items-center rounded-full transition', option.value === props.view ? 'bg-surface-3 text-gold-300' : 'text-muted hover:text-text')}>
              <Icon path={option.icon} />
            </button>
          ))}
        </div>
        <button onClick={props.onOpenSheet} className="h-11 shrink-0 rounded-full border border-gold-300/30 px-4 text-[13px] font-medium lg:hidden">
          Filters
        </button>
      </div>
      <div className="mx-auto flex max-w-[1560px] items-center gap-3 px-6 pt-1 pb-5 text-[13px] md:px-12 lg:gap-8">
        <div className="hidden items-center gap-1 lg:flex">
          <span className="mr-2 text-muted">Status</span>
          {statusOptions.map(option => (
            <button key={option.value} aria-pressed={option.value === props.status} onClick={() => props.onStatus(option.value)} className={cx('h-8 rounded-full px-3 font-medium transition', option.value === props.status ? 'bg-surface-3 text-gold-300' : 'text-muted hover:text-text')}>
              {option.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {props.isFiltered && (
          <button onClick={props.onReset} className="border-b border-gold-300/40 pb-px font-medium text-gold-300">
            Clear all
          </button>
        )}
        <span className="text-muted tnum">{props.countText}</span>
        <div className="hidden lg:block">
          <SortMenu value={props.sort} onChange={props.onSort} />
        </div>
      </div>
      <div className="mx-auto max-w-[1560px] overflow-x-auto px-6 pb-3 md:px-12 lg:hidden">
        <div className="flex gap-2">
          {chips.map(chip => (
            <button key={chip.id} onClick={() => props.onCategory(String(chip.id))} className={cx(pill(String(chip.id) === props.categoryId), 'flex h-9 items-center gap-2 px-3.5 text-[13px]')}>
              {chip.name}
              <span className="text-[11px] opacity-60 tnum">{chip.activeItems}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const SheetSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3">
    <span className="text-[10.5px] font-semibold tracking-[0.22em] text-muted uppercase">{label}</span>
    {children}
  </div>
);

export const FilterSheet = ({ status, sort, matchCount, onStatus, onSort, onReset, onClose }: { status: string; sort: string; matchCount: number | null; onStatus: (value: string) => void; onSort: (value: string) => void; onReset: () => void; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 lg:hidden">
    <button aria-label="Close filters" onClick={onClose} className="absolute inset-0 bg-black/60" />
    <div role="dialog" aria-label="Filters" className="rise absolute right-0 bottom-0 left-0 flex max-h-[88%] flex-col gap-6 overflow-y-auto rounded-t-md border-t border-line-strong bg-surface-2 px-5 pt-3 pb-8">
      <span className="h-1 w-9 self-center rounded-full bg-white/18" />
      <div className="flex items-baseline justify-between">
        <p className="display text-3xl">Filters</p>
        <button onClick={onReset} className="min-h-11 text-sm font-medium text-gold-300">
          Reset
        </button>
      </div>
      <SheetSection label="Status">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => (
            <button key={option.value} onClick={() => onStatus(option.value)} className={cx(pill(option.value === status), 'h-11 px-4 text-sm')}>
              {option.label}
            </button>
          ))}
        </div>
      </SheetSection>
      <SheetSection label="Sort by">
        <div className="flex flex-col">
          {sortOptions.map(option => (
            <button key={option.value} onClick={() => onSort(option.value)} className={cx('flex h-12 items-center justify-between border-b border-gold-300/10 text-left text-[15px]', option.value === sort ? 'text-gold-300' : 'text-text')}>
              {option.label}
              <span className={cx('grid size-5 place-items-center rounded-full border', option.value === sort ? 'border-gold-300' : 'border-gold-300/30')}>
                <span className={cx('size-2.5 rounded-full bg-gold-300 transition-transform', option.value === sort ? 'scale-100' : 'scale-0')} />
              </span>
            </button>
          ))}
        </div>
      </SheetSection>
      <button onClick={onClose} className="h-14 rounded-full bg-text text-base font-semibold text-ink tnum">
        {matchCount === null ? 'Show lots' : `Show ${matchCount} lots`}
      </button>
    </div>
  </div>
);
