import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuctionBrowser } from '@/site/components/AuctionBrowser';

export const metadata: Metadata = { title: 'Browse auctions' };

export default function AuctionsPage() {
  return (
    <Suspense>
      <AuctionBrowser />
    </Suspense>
  );
}
