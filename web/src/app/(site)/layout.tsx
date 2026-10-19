import type { Metadata } from 'next';
import { DM_Serif_Text, Mona_Sans } from 'next/font/google';
import { Footer } from '@/site/components/Footer';
import { Navbar } from '@/site/components/Navbar';
import { Providers } from '@/site/components/Providers';
import '@/site/site.css';

const monaSans = Mona_Sans({ subsets: ['latin'], variable: '--font-mona-sans', display: 'swap' });
const dmSerif = DM_Serif_Text({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dm-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'BidNest', template: '%s | BidNest' },
  description: 'Bid in real time on rare collectibles, electronics and more.',
  icons: { icon: '/images/logo.png' },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${monaSans.variable} ${dmSerif.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 md:px-8">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
