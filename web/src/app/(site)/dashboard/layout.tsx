import type { Metadata } from 'next';
import { DashboardTabs } from '@/site/components/dashboard';
import { RequireAuth } from '@/site/components/RequireAuth';
import { PageHeading } from '@/site/components/ui';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PageHeading eyebrow="Your account" title="Dashboard" />
      <DashboardTabs />
      {children}
    </RequireAuth>
  );
}
