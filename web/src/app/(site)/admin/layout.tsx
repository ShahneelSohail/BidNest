import type { Metadata } from 'next';
import { AdminTabs } from '@/site/components/admin';
import { RequireAuth } from '@/site/components/RequireAuth';
import { PageHeading } from '@/site/components/ui';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="ADMIN">
      <PageHeading eyebrow="Administration" title="Admin console" />
      <AdminTabs />
      {children}
    </RequireAuth>
  );
}
