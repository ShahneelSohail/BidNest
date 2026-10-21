'use client';

import { useEffect, useState } from 'react';
import { lotNumber } from './ItemCard';
import { cx } from './ui';

interface GalleryImage {
  id: number;
  url: string;
}

const NavButton = ({ label, onClick, path }: { label: string; onClick: () => void; path: string }) => (
  <button onClick={onClick} aria-label={label} className="grid size-14 shrink-0 place-items-center rounded-full border border-line-strong text-text transition hover:bg-surface-2">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  </button>
);

const Lightbox = ({ images, index, lotId, onChange, onClose }: { images: GalleryImage[]; index: number; lotId: number; onChange: (index: number) => void; onClose: () => void }) => {
  const step = (delta: number) => onChange((index + delta + images.length) % images.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-label="Image viewer" className="rise fixed inset-0 z-[60] flex flex-col bg-[rgba(3,3,3,0.96)]">
      <div className="flex h-[72px] items-center justify-between border-b border-line px-6 sm:px-8">
        <span className="eyebrow">
          {lotNumber(lotId)} · <span className="text-text-2 tnum">{index + 1} / {images.length}</span>
        </span>
        <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full border border-line-strong text-text transition hover:bg-surface-2">
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-4 p-4 sm:p-8">
        {images.length > 1 && <NavButton label="Previous image" onClick={() => step(-1)} path="m15 18-6-6 6-6" />}
        <img src={images[index]!.url} alt={`${lotNumber(lotId)} enlarged`} className="mx-auto max-h-full min-w-0 object-contain" />
        {images.length > 1 && <NavButton label="Next image" onClick={() => step(1)} path="m9 18 6-6-6-6" />}
      </div>
    </div>
  );
};

export const AuctionGallery = ({ images, title, lotId }: { images: GalleryImage[]; title: string; lotId: number }) => {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const image = images[index];

  return (
    <div className={cx('grid gap-4', images.length > 1 && 'lg:grid-cols-[80px_minmax(0,1fr)]')}>
      {images.length > 1 && (
      <div className="order-2 flex gap-3 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-visible">
        {images.map((thumb, thumbIndex) => (
            <button key={thumb.id} onClick={() => setIndex(thumbIndex)} aria-label={`View image ${thumbIndex + 1}`} className={cx('h-[100px] w-20 shrink-0 overflow-hidden border bg-surface-2 transition', thumbIndex === index ? 'border-gold-300' : 'border-line opacity-60 hover:opacity-100')}>
              <img src={thumb.url} alt="" className="size-full object-cover" />
            </button>
          ))}
      </div>
      )}
      <button onClick={() => image && setZoomed(true)} aria-label="Open image viewer" className="group relative order-1 aspect-[4/5] max-h-[820px] w-full cursor-zoom-in overflow-hidden bg-surface-2 lg:order-2">
        {image ? (
          <img src={image.url} alt={title} className="size-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-expo)] group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted">No image</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent via-20% to-ink/55 to-100%" />
        <span className="absolute top-5 left-5 bg-ink/70 px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-gold-300 uppercase backdrop-blur">{lotNumber(lotId)}</span>
        <div className="pointer-events-none absolute right-5 bottom-5 left-5 flex items-center justify-between">
          <span className="text-xs tracking-[0.08em] text-text tnum">
            {index + 1} / {Math.max(images.length, 1)}
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-ink/70 text-text backdrop-blur">⤢</span>
        </div>
      </button>
      {zoomed && images.length > 0 && <Lightbox images={images} index={index} lotId={lotId} onChange={setIndex} onClose={() => setZoomed(false)} />}
    </div>
  );
};
