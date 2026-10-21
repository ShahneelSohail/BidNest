import type { Metadata } from 'next';
import { DashboardShell } from '@/site/components/dashboard';
import { RequireAuth } from '@/site/components/RequireAuth';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}
