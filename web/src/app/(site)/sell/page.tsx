import type { Metadata } from 'next';
import { SellDashboard } from '@/site/components/sell';

export const metadata: Metadata = { title: 'Sell' };

export default async function SellPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <SellDashboard initialStatus={status} />;
}
