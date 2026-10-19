import type { Metadata } from 'next';
import { MyMessages } from '@/site/components/dashboard';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return <MyMessages />;
}
