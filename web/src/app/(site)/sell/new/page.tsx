import type { Metadata } from 'next';
import { ListingForm } from '@/site/components/sell-form';

export const metadata: Metadata = { title: 'List an item' };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <ListingForm mode="new" sourceId={from ? Number(from) : undefined} />;
}
