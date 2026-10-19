'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, withQuery } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { Category, ItemDetail, ListItem } from '../lib/types';
import { Countdown } from './ItemCard';
import { useToast } from './Providers';
import { Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, PageHeading, Pagination, Select, Spinner, StatCard, StatusBadge, Textarea } from './ui';

interface SellerOverview {
  stats: { activeListings: number; pendingListings: number; soldItems: number; totalEarnings: number; averageSellingPrice: number };
}

interface SellerItem extends ListItem {
  rejectionReason: string | null;
}

const statusFilters = ['all', 'pending', 'active', 'sold', 'expired', 'rejected'] as const;

const ListingRow = ({ item }: { item: SellerItem }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/seller/items/${item.id}`),
    onSuccess: () => {
      toast('success', 'Listing deleted.');
      return queryClient.invalidateQueries({ queryKey: ['seller-items'] });
    },
    onError: error => toast('error', error.message),
  });
  const extend = useMutation({
    mutationFn: () => api.post(`/seller/items/${item.id}/extend`, { hours: 24 }),
    onSuccess: () => {
      toast('success', 'Auction extended by 24 hours.');
      return queryClient.invalidateQueries({ queryKey: ['seller-items'] });
    },
    onError: error => toast('error', error.message),
  });

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-3">
          <Link href={`/auctions/${item.id}`} className="truncate font-medium hover:text-yellow">
            {item.title}
          </Link>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-sm text-muted">
          {formatMoney(item.currentPrice)} · {item.bidCount} bids
          {item.status === 'active' && (
            <>
              {' '}
              · ends in <Countdown endDate={item.endDate} />
            </>
          )}
        </p>
        {item.rejectionReason && <p className="text-sm text-red-300">Rejected: {item.rejectionReason}</p>}
      </div>
      <div className="flex gap-2">
        {item.status === 'active' && (
          <Button variant="secondary" disabled={extend.isPending} onClick={() => extend.mutate()}>
            Extend 24h
          </Button>
        )}
        {!item.hasBids && (
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
};

export const SellDashboard = () => {
  const [status, setStatus] = useState<(typeof statusFilters)[number]>('all');
  const [page, setPage] = useState(1);
  const overview = useQuery({ queryKey: ['seller-overview'], queryFn: () => api.get<SellerOverview>('/seller/dashboard') });
  const items = useQuery({ queryKey: ['seller-items', status, page], queryFn: () => api.page<SellerItem>(withQuery('/seller/items', { status, page })) });

  return (
    <>
      <PageHeading eyebrow="Seller" title="Your listings" action={<LinkButton href="/sell/new">List an item</LinkButton>} />
      {overview.data && (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Live listings" value={overview.data.stats.activeListings} />
          <StatCard label="Awaiting approval" value={overview.data.stats.pendingListings} />
          <StatCard label="Items sold" value={overview.data.stats.soldItems} />
          <StatCard label="Total earnings" value={formatMoney(overview.data.stats.totalEarnings)} />
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        {statusFilters.map(option => (
          <Button
            key={option}
            variant={option === status ? 'primary' : 'secondary'}
            className="capitalize"
            onClick={() => {
              setStatus(option);
              setPage(1);
            }}
          >
            {option}
          </Button>
        ))}
      </div>
      {items.isPending && <Spinner />}
      {items.error && <ErrorState message={items.error.message} />}
      {items.data &&
        (items.data.items.length === 0 ? (
          <EmptyState title="No listings here" hint="Create a listing and an admin will review it before it goes live." action={<LinkButton href="/sell/new">List an item</LinkButton>} />
        ) : (
          <>
            <div className="space-y-3">
              {items.data.items.map(item => (
                <ListingRow key={item.id} item={item} />
              ))}
            </div>
            <Pagination meta={items.data.meta} onChange={setPage} />
          </>
        ))}
    </>
  );
};

export const NewListingForm = () => {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (form: FormData) => api.post<ItemDetail>('/seller/items', form),
    onSuccess: () => {
      toast('success', 'Listing submitted for approval.');
      void queryClient.invalidateQueries({ queryKey: ['seller-items'] });
      router.push('/sell');
    },
    onError: failure => setError(failure.message),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    create.mutate(new FormData(event.currentTarget));
  };

  return (
    <Card className="mx-auto max-w-2xl p-8">
      <PageHeading eyebrow="Seller" title="List an item" />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Item name">
          <Input name="title" required minLength={5} maxLength={200} />
        </Field>
        <Field label="Description">
          <Textarea name="description" maxLength={4000} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category">
            <Select name="categoryId" defaultValue="">
              <option value="">Uncategorised</option>
              {categories.data?.flatMap(root => [root, ...(root.children ?? [])]).map(category => (
                <option key={category.id} value={category.id}>
                  {category.parentId ? '— ' : ''}
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starting bid (USD)">
            <Input name="minBid" type="number" min="1" step="0.01" required />
          </Field>
          <Field label="Duration (days)">
            <Input name="durationDays" type="number" min="1" max="30" defaultValue="7" required />
          </Field>
        </div>
        <Field label="Photos (the first is the cover)">
          <Input name="images" type="file" accept="image/*" multiple className="file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-black" />
        </Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={create.isPending} className="w-full">
          {create.isPending ? 'Submitting…' : 'Submit for approval'}
        </Button>
      </form>
    </Card>
  );
};
