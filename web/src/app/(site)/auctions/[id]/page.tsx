import { notFound } from 'next/navigation';
import { AuctionDetail } from '@/site/components/AuctionDetail';

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <AuctionDetail itemId={id} />;
}
