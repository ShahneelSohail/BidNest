const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const formatMoney = (value: number | null | undefined): string => currency.format(value ?? 0);
export const formatDateTime = (value: string): string => dateTime.format(new Date(value));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatTimeLeft = (endDate: string, now: number): string => {
  const remaining = new Date(endDate).getTime() - now;
  if (remaining <= 0) return 'Ended';
  const days = Math.floor(remaining / DAY);
  const hours = Math.floor((remaining % DAY) / HOUR);
  const minutes = Math.floor((remaining % HOUR) / MINUTE);
  const seconds = Math.floor((remaining % MINUTE) / SECOND);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export type Urgency = 'normal' | 'urgent' | 'critical';

export const urgencyOf = (endDate: string, now: number): Urgency => {
  const remaining = new Date(endDate).getTime() - now;
  if (remaining <= 5 * MINUTE) return 'critical';
  return remaining <= HOUR ? 'urgent' : 'normal';
};

export const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
