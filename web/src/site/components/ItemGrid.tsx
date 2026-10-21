'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api, withQuery } from '../lib/api';
import type { ListItem } from '../lib/types';
import { EmptyState, ErrorState, Pagination, Spinner } from './ui';

const PAGE_SIZE = 12;

export const PagedItems = <T extends ListItem>({ path, params, empty, children }: { path: string; params?: Record<string, string>; empty: ReactNode; children: (items: T[]) => ReactNode }) => {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: [path, params, page], queryFn: () => api.page<T>(withQuery(path, { ...params, page, pageSize: PAGE_SIZE })) });

  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorState message={query.error.message} />;
  if (query.data.items.length === 0) return <>{empty}</>;

  return (
    <>
      {children(query.data.items)}
      <Pagination meta={query.data.meta} onChange={setPage} />
    </>
  );
};

export const NoItems = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => <EmptyState title={title} hint={hint} action={action} />;
