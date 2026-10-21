import type { Metadata } from 'next';
import { ListingForm } from '@/site/components/sell-form';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingForm mode="edit" sourceId={Number(id)} />;
}
