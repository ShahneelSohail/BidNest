'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { formatDay, formatWholeMoney, type AnalyticsRange, type DailyEarning } from '../lib/seller';

interface Bucket {
  start: string;
  end: string;
  earnings: number;
  itemsSold: number;
}

const WIDTH = 800;
const HEIGHT = 240;
const GRID_ROWS = [60, 120, 180];
const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
const DAY_FORMAT = { month: 'short', day: 'numeric' } as const;

export const bucketize = (daily: DailyEarning[], size: number): Bucket[] => {
  const buckets: Bucket[] = [];
  for (let end = daily.length; end > 0; end -= size) {
    const chunk = daily.slice(Math.max(0, end - size), end);
    buckets.unshift({
      start: chunk[0]!.day,
      end: chunk[chunk.length - 1]!.day,
      earnings: chunk.reduce((sum, day) => sum + day.earnings, 0),
      itemsSold: chunk.reduce((sum, day) => sum + day.itemsSold, 0),
    });
  }
  return buckets;
};

export const EarningsChart = ({ daily, range }: { daily: DailyEarning[]; range: AnalyticsRange }) => {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = useMemo(() => bucketize(daily, range.bucketDays), [daily, range.bucketDays]);
  const last = buckets.length - 1;
  const max = Math.max(...buckets.map(bucket => bucket.earnings), 1) * 1.15;
  const points = buckets.map((bucket, index) => [(index / last) * WIDTH, 236 - (bucket.earnings / max) * 220] as const);
  const line = `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
  const activeIndex = hover ?? last;
  const [activeX, activeY] = points[activeIndex]!;
  const active = buckets[activeIndex]!;
  const label = range.bucketDays === 1 ? formatDay(active.start, DAY_FORMAT) : `${formatDay(active.start, DAY_FORMAT)} – ${formatDay(active.end, DAY_FORMAT)}`;

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(last, Math.round(((event.clientX - box.left) / box.width) * last))));
  };

  return (
    <div className="space-y-3">
      <div onPointerMove={track} onPointerLeave={() => setHover(null)} className="relative h-40 cursor-crosshair md:h-60" role="img" aria-label={`Earnings chart, ${range.summary}`}>
        <svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id="earnings-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#e7d393" stopOpacity=".3" />
              <stop offset="1" stopColor="#e7d393" stopOpacity="0" />
            </linearGradient>
          </defs>
          {GRID_ROWS.map(y => (
            <line key={y} x1="0" x2={WIDTH} y1={y} y2={y} stroke="rgba(255,255,255,.05)" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2={WIDTH} y1={HEIGHT - 1} y2={HEIGHT - 1} stroke="rgba(231,211,147,.25)" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} fill="url(#earnings-fill)" />
          <path d={line} fill="none" stroke="#e7d393" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={activeX} x2={activeX} y1="0" y2={HEIGHT} stroke="rgba(231,211,147,.45)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="pointer-events-none absolute -mt-1.5 -ml-1.5 size-3 rounded-full border-2 border-gold-300 bg-ink" style={{ left: `${(activeX / WIDTH) * 100}%`, top: `${(activeY / HEIGHT) * 100}%` }} />
        <div
          className="pointer-events-none absolute top-0 rounded-sm border border-line-strong bg-surface-3 px-3 py-2.5 whitespace-nowrap shadow-e3"
          style={{ left: `${(activeX / WIDTH) * 100}%`, transform: `translateX(${activeX > WIDTH * 0.75 ? 'calc(-100% - 14px)' : '14px'})` }}
        >
          <p className="text-[11px] text-muted">{label}</p>
          <p className="display mt-0.5 text-[22px] text-gold-300">{formatWholeMoney(active.earnings)}</p>
          <p className="mt-0.5 text-[11px] text-muted">{active.itemsSold ? `${active.itemsSold} ${active.itemsSold === 1 ? 'lot' : 'lots'} sold` : 'No sales'}</p>
        </div>
      </div>
      <div className="tnum flex justify-between text-[11px] text-muted">
        {TICK_FRACTIONS.map(fraction => (
          <span key={fraction}>{formatDay(buckets[Math.round(fraction * last)]!.start, range.tick)}</span>
        ))}
      </div>
    </div>
  );
};
