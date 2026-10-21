import type { Metadata } from 'next';
import { AdminShell } from '@/site/components/admin';
import { RequireAuth } from '@/site/components/RequireAuth';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="ADMIN">
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
