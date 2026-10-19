import { RequireAuth } from '@/site/components/RequireAuth';

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
