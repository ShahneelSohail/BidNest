'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api, withQuery } from '../lib/api';
import type { ListItem } from '../lib/types';
import { ItemCard } from './ItemCard';
import { EmptyState, ErrorState, Pagination, Spinner } from './ui';

const PAGE_SIZE = 12;

export const ItemGrid = <T extends ListItem>({ path, params, empty, renderFooter }: { path: string; params?: Record<string, string>; empty: ReactNode; renderFooter?: (item: T) => ReactNode }) => {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: [path, params, page], queryFn: () => api.page<T>(withQuery(path, { ...params, page, pageSize: PAGE_SIZE })) });

  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorState message={query.error.message} />;
  if (query.data.items.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {query.data.items.map(item => (
          <div key={item.id} className="space-y-2">
            <ItemCard item={item} />
            {renderFooter?.(item)}
          </div>
        ))}
      </div>
      <Pagination meta={query.data.meta} onChange={setPage} />
    </>
  );
};

export const NoItems = ({ title, hint }: { title: string; hint?: string }) => <EmptyState title={title} hint={hint} />;
