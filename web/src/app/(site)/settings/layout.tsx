import type { Metadata } from 'next';
import { RequireAuth } from '@/site/components/RequireAuth';
import { SettingsShell } from '@/site/components/settings-shell';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SettingsShell>{children}</SettingsShell>
    </RequireAuth>
  );
}
