import Link from 'next/link';

export const Footer = () => (
  <footer className="border-t border-line py-10 text-sm text-muted">
    <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-6 md:px-12">
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
