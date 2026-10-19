'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '../lib/types';
import { useAuth } from './Providers';
import { EmptyState, LinkButton, Spinner } from './ui';

export const RequireAuth = ({ role, children }: { role?: Role; children: ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <Spinner />;
  if (role && user.role !== role) return <EmptyState title="You don't have access to this page" action={<LinkButton href="/dashboard">Back to dashboard</LinkButton>} />;
  return children;
};
