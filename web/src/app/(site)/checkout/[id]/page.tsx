import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Checkout } from '@/site/components/checkout-flow';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <Checkout itemId={id} />;
}
