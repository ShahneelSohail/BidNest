import type { Metadata } from 'next';
import { WonAuctions } from '@/site/components/dashboard';

export const metadata: Metadata = { title: 'Won auctions' };

export default function Page() {
  return <WonAuctions />;
}
