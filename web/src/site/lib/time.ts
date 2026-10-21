const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const weekdayDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatShortDate = (value: string | Date): string => shortDate.format(new Date(value));
export const formatFullDate = (value: string | Date): string => fullDate.format(new Date(value));
export const formatWeekday = (value: Date): string => weekdayDate.format(value);

export const timeAgo = (value: string): string => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return formatShortDate(value);
};

export const dayGroup = (value: string): 'Today' | 'Yesterday' | 'Earlier' => {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const time = new Date(value).getTime();
  if (time >= startOfToday) return 'Today';
  return time >= startOfToday - DAY ? 'Yesterday' : 'Earlier';
};

export const greeting = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
