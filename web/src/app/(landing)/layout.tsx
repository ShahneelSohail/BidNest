import type { Metadata } from 'next';
import { DM_Serif_Text, Mona_Sans } from 'next/font/google';
import '@/landing/landing.css';

const monaSans = Mona_Sans({ subsets: ['latin'], variable: '--font-mona-sans', display: 'swap' });
const dmSerif = DM_Serif_Text({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dm-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'BidNest | Real-time online auctions',
  description: 'Discover rare collectibles, electronics and great bargains. Bid in real time on BidNest.',
  icons: { icon: '/images/logo.png' },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${monaSans.variable} ${dmSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
