'use client';

import { formatDateTime, urgencyOf, type Urgency } from '../lib/format';
import { useNow } from '../lib/hooks';
import { cx } from './ui';

const urgencyStyles: Record<Urgency, { label: string; labelColor: string; border: string; value: string }> = {
  normal: { label: 'Time left', labelColor: 'text-muted', border: 'border-line', value: 'text-text' },
  urgent: { label: 'Ending soon · under 1 hour', labelColor: 'text-outbid', border: 'border-outbid/35', value: 'text-text' },
  critical: { label: 'Closing · under 5 minutes', labelColor: 'text-danger', border: 'border-danger/45 live-dot', value: 'text-danger' },
};

const pad = (value: number) => String(value).padStart(2, '0');

export const AuctionCountdown = ({ endDate }: { endDate: string }) => {
  const now = useNow();
  const remaining = Math.max(0, Math.floor((new Date(endDate).getTime() - now) / 1000));
  const style = urgencyStyles[urgencyOf(endDate, now)];
  const cells = [
    { label: 'Days', value: Math.floor(remaining / 86400) },
    { label: 'Hours', value: Math.floor((remaining % 86400) / 3600) },
    { label: 'Min', value: Math.floor((remaining % 3600) / 60) },
    { label: 'Sec', value: remaining % 60 },
  ];

  return (
    <div className="flex flex-col gap-3" suppressHydrationWarning>
      <div className="flex items-baseline justify-between">
        <span className={cx('text-[11px] font-semibold tracking-[0.22em] uppercase', style.labelColor)}>{style.label}</span>
        <span className="text-xs text-muted">Ends {formatDateTime(endDate)}</span>
      </div>
      <div className={cx('grid grid-cols-4 border', style.border)}>
        {cells.map((cell, index) => (
          <div key={cell.label} className={cx('pt-3.5 pb-3 text-center', index > 0 && 'border-l border-line')}>
            <p className={cx('text-3xl leading-none font-medium tracking-[-0.01em] tnum sm:text-4xl', style.value)}>{pad(cell.value)}</p>
            <p className="mt-1.5 text-[10px] tracking-[0.2em] text-muted uppercase">{cell.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
