'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import type { Category, ListItem } from '../lib/types';
import { AuctionEndingRail } from './auction-ending-rail';
import { FilterBar, FilterSheet, type ViewMode } from './auction-filters';
import { AuctionListRow } from './auction-list-row';
import { ItemCard, ItemCardSkeleton } from './ItemCard';
import { Button, ErrorState } from './ui';

const PAGE_SIZE = 12;
const SKELETON_COUNT = 8;
const VIEW_STORAGE_KEY = 'bidnest:browse-view';
const DEFAULTS = { q: '', categoryId: '', status: 'active', sort: 'ending' };

const heroStats = (live: number | undefined, endingToday: number | undefined, categories: number | undefined) => [
  { label: 'Live auctions', value: live, live: true },
  { label: 'Ending today', value: endingToday, live: false },
  { label: 'Categories', value: categories, live: false },
];

export const AuctionBrowser = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [view, setView] = useState<ViewMode>('grid');
  const [sheetOpen, setSheetOpen] = useState(false);
  const debouncedSearch = useDebounced(search);
  const filters = { q: params.get('q') ?? DEFAULTS.q, categoryId: params.get('categoryId') ?? DEFAULTS.categoryId, status: params.get('status') ?? DEFAULTS.status, sort: params.get('sort') ?? DEFAULTS.sort };
  const isFiltered = Object.entries(DEFAULTS).some(([key, fallback]) => filters[key as keyof typeof filters] !== fallback);

  const update = (changes: Partial<typeof filters>) => router.replace(withQuery('/auctions', { ...filters, ...changes }), { scroll: false });
  const reset = () => {
    setSearch('');
    update(DEFAULTS);
  };

  useEffect(() => {
    if (debouncedSearch !== filters.q) update({ q: debouncedSearch });
  }, [debouncedSearch]);

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'grid' || stored === 'list') setView(stored);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const liveCount = useQuery({ queryKey: ['items', 'live-count'], queryFn: () => api.page<ListItem>(withQuery('/items', { status: 'active', pageSize: 1 })) });
  const rail = useQuery({ queryKey: ['items', 'rail'], queryFn: () => api.page<ListItem>(withQuery('/items', { status: 'today', sort: 'ending', pageSize: 5 })) });
  const items = useInfiniteQuery({
    queryKey: ['items', 'browse', filters],
    queryFn: ({ pageParam }) => api.page<ListItem>(withQuery('/items', { ...filters, page: pageParam, pageSize: PAGE_SIZE })),
    initialPageParam: 1,
    getNextPageParam: last => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });

  const leafCategories = (categories.data ?? []).flatMap(root => (root.children?.length ? root.children : [root])).filter(category => category.activeItems > 0);
  const loaded = items.data?.pages.flatMap(page => page.items) ?? [];
  const total = items.data?.pages[0]?.meta.total ?? null;
  const relax = [
    { label: 'Any status', show: filters.status !== DEFAULTS.status, go: () => update({ status: DEFAULTS.status }) },
    { label: 'All categories', show: Boolean(filters.categoryId), go: () => update({ categoryId: '' }) },
    { label: 'Clear search', show: Boolean(filters.q), go: () => { setSearch(''); update({ q: '' }); } },
  ].filter(option => option.show).slice(0, 2);

  return (
    <>
      <section className="rise mb-14 grid items-end gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div>
          <p className="eyebrow mb-5">The catalogue · Evening sale</p>
          <h1 className="display text-7xl md:text-[112px] md:leading-[0.94] md:tracking-[-0.02em]">
            The room
            <br />
            is <em className="gold-text">live.</em>
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-5 lg:gap-7">
          {heroStats(liveCount.data?.meta.total, rail.data?.meta.total, categories.data?.length).map(stat => (
            <div key={stat.label} className="border-t border-line-strong pt-4">
              <p className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.2em] text-muted uppercase">
                {stat.live && <span className="live-dot size-1.5 rounded-full bg-live" />}
                {stat.label}
              </p>
              <p className="display tnum mt-2.5 text-4xl lg:text-5xl">{stat.value ?? '–'}</p>
            </div>
          ))}
        </div>
      </section>

      {!isFiltered && rail.data && <AuctionEndingRail items={rail.data.items} onSeeAll={() => update({ status: 'today' })} />}

      <FilterBar
        search={search}
        onSearch={setSearch}
        categories={leafCategories}
        categoryId={filters.categoryId}
        onCategory={categoryId => update({ categoryId })}
        status={filters.status}
        onStatus={status => update({ status })}
        sort={filters.sort}
        onSort={sort => update({ sort })}
        view={view}
        onView={changeView}
        countText={total === null ? '' : `${total} ${total === 1 ? 'lot' : 'lots'}`}
        isFiltered={isFiltered}
        onReset={reset}
        onOpenSheet={() => setSheetOpen(true)}
      />
      {sheetOpen && <FilterSheet status={filters.status} sort={filters.sort} matchCount={total} onStatus={status => update({ status })} onSort={sort => update({ sort })} onReset={reset} onClose={() => setSheetOpen(false)} />}

      <section className="min-h-[720px] pt-12 pb-8">
        {items.error && <ErrorState message={items.error.message} />}
        {items.isPending && (
          <div className="grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <ItemCardSkeleton key={index} />
            ))}
          </div>
        )}
        {items.data && loaded.length === 0 && (
          <div className="flex flex-col items-center gap-[18px] py-16 text-center">
            <div className="gavel-mask h-[110px] w-[150px] opacity-80" />
            <p className="display text-4xl md:text-[40px]">Nothing on the block</p>
            <p className="max-w-[440px] text-[15px] leading-relaxed text-muted">No live lots match these filters. Loosen one filter and try again.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {relax.map(option => (
                <Button key={option.label} variant="secondary" onClick={option.go}>
                  {option.label}
                </Button>
              ))}
              <Button onClick={reset}>Reset filters</Button>
            </div>
          </div>
        )}
        {loaded.length > 0 && view === 'grid' && (
          <div className="grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loaded.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
        {loaded.length > 0 && view === 'list' && (
          <div className="flex flex-col border-t border-line-strong">
            {loaded.map(item => (
              <AuctionListRow key={item.id} item={item} />
            ))}
          </div>
        )}
        {total !== null && loaded.length > 0 && (
          <div className="mt-16 flex flex-col items-center gap-3.5">
            {items.hasNextPage ? (
              <>
                <div className="h-px w-60 bg-white/8">
                  <div className="h-full bg-gold-300" style={{ width: `${Math.min(100, (loaded.length / total) * 100)}%` }} />
                </div>
                <p className="text-[13px] text-muted tnum">
                  Showing {loaded.length} of {total} lots
                </p>
                <Button variant="secondary" size="lg" disabled={items.isFetchingNextPage} onClick={() => items.fetchNextPage()}>
                  {items.isFetchingNextPage ? 'Loading…' : 'Show more lots'}
                </Button>
              </>
            ) : (
              loaded.length > PAGE_SIZE && <p className="text-[13px] text-muted">That&apos;s every lot matching your filters.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
};
