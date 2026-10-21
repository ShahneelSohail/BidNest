import type { Metadata } from 'next';
import { SettingsProfile } from '@/site/components/settings-profile';

export const metadata: Metadata = { title: 'Profile settings' };

export default function Page() {
  return <SettingsProfile />;
}
