import type { Metadata } from 'next';
import { SettingsSecurity } from '@/site/components/settings-security';

export const metadata: Metadata = { title: 'Password and security' };

export default function Page() {
  return <SettingsSecurity />;
}
