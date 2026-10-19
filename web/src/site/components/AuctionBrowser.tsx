'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import type { Category, ListItem } from '../lib/types';
import { ItemCard } from './ItemCard';
import { EmptyState, ErrorState, Field, Input, PageHeading, Pagination, Select, Spinner } from './ui';

const statusOptions = [
  { value: 'active', label: 'Live now' },
  { value: 'ending', label: 'Ending in 24h' },
  { value: 'sold', label: 'Sold' },
  { value: 'expired', label: 'Expired' },
];

const sortOptions = [
  { value: 'ending', label: 'Ending soonest' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'bids', label: 'Most bids' },
];

const selectFilters = [
  { key: 'status', label: 'Status', options: statusOptions, fallback: 'active' },
  { key: 'sort', label: 'Sort by', options: sortOptions, fallback: 'ending' },
] as const;

const PAGE_SIZE = 12;

export const AuctionBrowser = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(search);
  const filters = { q: params.get('q') ?? '', categoryId: params.get('categoryId') ?? '', status: params.get('status') ?? 'active', sort: params.get('sort') ?? 'ending', page: Number(params.get('page') ?? 1) };

  const update = (changes: Record<string, string | number>) => {
    const next = { ...filters, page: 1, ...changes };
    router.replace(withQuery('/auctions', next), { scroll: false });
  };

  useEffect(() => {
    if (debouncedSearch !== filters.q) update({ q: debouncedSearch });
  }, [debouncedSearch]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const items = useQuery({ queryKey: ['items', filters], queryFn: () => api.page<ListItem>(withQuery('/items', { ...filters, pageSize: PAGE_SIZE })) });

  return (
    <>
      <PageHeading eyebrow="Live marketplace" title="Browse auctions" />
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Field label="Search">
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="What are you looking for?" />
        </Field>
        <Field label="Category">
          <Select value={filters.categoryId} onChange={event => update({ categoryId: event.target.value })}>
            <option value="">All categories</option>
            {categories.data?.flatMap(root => [root, ...(root.children ?? [])]).map(category => (
              <option key={category.id} value={category.id}>
                {category.parentId ? '— ' : ''}
                {category.name} ({category.activeItems})
              </option>
            ))}
          </Select>
        </Field>
        {selectFilters.map(filter => (
          <Field key={filter.key} label={filter.label}>
            <Select value={filters[filter.key]} onChange={event => update({ [filter.key]: event.target.value })}>
              {filter.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>

      {items.isPending && <Spinner />}
      {items.error && <ErrorState message={items.error.message} />}
      {items.data && (items.data.items.length === 0 ? <EmptyState title="No auctions match your filters" hint="Try a different search or category." /> : (
        <>
          <p className="mb-4 text-sm text-muted">{items.data.meta.total} auctions</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.data.items.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
          <Pagination meta={items.data.meta} onChange={page => update({ page })} />
        </>
      ))}
    </>
  );
};
