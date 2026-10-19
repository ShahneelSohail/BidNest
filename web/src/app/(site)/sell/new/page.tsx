import type { Metadata } from 'next';
import { NewListingForm } from '@/site/components/sell';

export const metadata: Metadata = { title: 'List an item' };

export default function NewListingPage() {
  return <NewListingForm />;
}
