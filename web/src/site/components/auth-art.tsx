import Link from 'next/link';
import { Eyebrow } from './ui';

const artCopy = { login: 'The room is open', register: 'Membership · free' } as const;

const collectors = [
  { initials: 'HK', style: 'bg-gold-900 text-gold-300' },
  { initials: 'MK', style: 'bg-surface-3 text-text-2' },
  { initials: 'AR', style: 'bg-gold-800 text-gold-100' },
  { initials: 'CO', style: 'bg-surface-3 text-text-2' },
];

const rings = ['size-[640px] border-gold-300/12', 'size-[860px] border-gold-300/6'];

export const AuthArt = ({ mode }: { mode: 'login' | 'register' }) => (
  <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden border-b border-line bg-[radial-gradient(ellipse_70%_60%_at_55%_42%,#1f1a0f_0%,#0c0b08_48%,#070707_78%)] px-6 py-8 sm:px-14 sm:py-10 lg:border-r lg:border-b-0">
    <style>{'@keyframes sway{0%,100%{transform:translate(-50%,-50%) rotate(-16deg)}50%{transform:translate(-50%,-50%) rotate(-11deg)}}'}</style>
    {rings.map(ring => (
      <div key={ring} className={`pointer-events-none absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${ring}`} />
    ))}
    <div className="gavel-mask pointer-events-none absolute top-[42%] left-1/2 h-[250px] w-[330px] -translate-x-1/2 -translate-y-1/2 -rotate-[16deg] drop-shadow-[0_40px_60px_rgba(0,0,0,0.7)] lg:h-[480px] lg:w-[600px] lg:[animation:sway_9s_ease-in-out_infinite]" />

    <div className="relative flex items-center justify-between">
      <span className="display gold-text text-2xl lg:text-3xl">BidNest</span>
      <Link href="/auctions" className="inline-flex items-center gap-2 text-[13px] text-text-2 transition hover:text-gold-300">
        <span aria-hidden>←</span>Back to auctions
      </Link>
    </div>

    <div className="relative hidden flex-col gap-7 lg:flex">
      <Eyebrow>{artCopy[mode]}</Eyebrow>
      <h2 className="display max-w-[560px] text-[64px] leading-none text-balance">
        Going once. Going twice. <em className="gold-text">Yours.</em>
      </h2>
      <div className="flex items-center gap-4">
        <div className="flex">
          {collectors.map((collector, index) => (
            <span key={collector.initials} className={`grid size-9 place-items-center rounded-full border-2 border-[#0c0b08] text-[11px] font-semibold ${collector.style} ${index ? '-ml-2.5' : ''}`}>
              {collector.initials}
            </span>
          ))}
        </div>
        <p className="text-sm leading-normal text-text-2">Collectors bid here in real time. Every lot is listed by a rated seller.</p>
      </div>
    </div>
  </div>
);
