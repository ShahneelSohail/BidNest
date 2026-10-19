import Link from 'next/link';

export const Footer = () => (
  <footer className="border-t border-line py-8 text-sm text-muted">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 md:px-8">
      <p>© {new Date().getFullYear()} BidNest. Real-time auctions.</p>
      <div className="flex gap-5">
        <Link href="/auctions" className="hover:text-white">
          Browse
        </Link>
        <Link href="/#contact" className="hover:text-white">
          Contact
        </Link>
      </div>
    </div>
  </footer>
);
