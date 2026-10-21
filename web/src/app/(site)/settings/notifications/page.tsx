import type { Metadata } from 'next';
import { SettingsNotifications } from '@/site/components/settings-notifications';

export const metadata: Metadata = { title: 'Notification settings' };

export default function Page() {
  return <SettingsNotifications />;
}
