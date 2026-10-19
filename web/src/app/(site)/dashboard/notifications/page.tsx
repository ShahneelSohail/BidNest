import type { Metadata } from 'next';
import { Notifications } from '@/site/components/dashboard';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <Notifications />;
}
