import type { Metadata } from 'next';
import { SellDashboard } from '@/site/components/sell';

export const metadata: Metadata = { title: 'Sell' };

export default function SellPage() {
  return <SellDashboard />;
}
