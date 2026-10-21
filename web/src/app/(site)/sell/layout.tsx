import { RequireAuth } from '@/site/components/RequireAuth';
import { SellShell } from '@/site/components/sell-shell';

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SellShell>{children}</SellShell>
    </RequireAuth>
  );
}
