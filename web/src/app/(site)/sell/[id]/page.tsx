import type { Metadata } from 'next';
import { ListingFeedback } from '@/site/components/sell-feedback';

export const metadata: Metadata = { title: 'Listing feedback' };

export default async function ListingFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingFeedback itemId={Number(id)} />;
}
