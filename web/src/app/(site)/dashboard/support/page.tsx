import type { Metadata } from 'next';
import { MyMessages } from '@/site/components/dashboard-messages';

export const metadata: Metadata = { title: 'Support' };

export default function Page() {
  return <MyMessages />;
}
