import type { Metadata } from 'next';
import { WonAuctions } from '@/site/components/dashboard-won';

export const metadata: Metadata = { title: 'Won items' };

export default function Page() {
  return <WonAuctions />;
}
