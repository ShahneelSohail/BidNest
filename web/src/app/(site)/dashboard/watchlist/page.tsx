import type { Metadata } from 'next';
import { Watchlist } from '@/site/components/dashboard';

export const metadata: Metadata = { title: 'Watchlist' };

export default function Page() {
  return <Watchlist />;
}
