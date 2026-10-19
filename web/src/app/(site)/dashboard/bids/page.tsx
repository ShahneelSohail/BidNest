import type { Metadata } from 'next';
import { MyBids } from '@/site/components/dashboard';

export const metadata: Metadata = { title: 'My bids' };

export default function Page() {
  return <MyBids />;
}
