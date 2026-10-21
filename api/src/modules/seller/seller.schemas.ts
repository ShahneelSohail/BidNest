import { z } from 'zod';
import { pageQuery } from '../../lib/pagination';

const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 30;
const MAX_EXTENSION_HOURS = 24 * 30;
export const CONDITIONS = ['Mint', 'Excellent', 'Very good', 'Good', 'Fair'] as const;

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters long`).max(max, `${label} cannot exceed ${max} characters`);

const optionalCategory = z.preprocess(value => (value === '' || value === undefined ? null : value), z.coerce.number().int().positive().nullable());

const listingFields = {
  title: text(5, 200, 'Item name'),
  description: z.string().trim().max(4000, 'Description cannot exceed 4000 characters').default(''),
  categoryId: optionalCategory,
  minBid: z.coerce.number().positive('Minimum bid must be greater than zero').max(1_000_000),
  condition: z.enum(CONDITIONS).optional(),
  increment: z.union([z.literal('auto'), z.coerce.number().positive('Bid increment must be greater than zero')]).default('auto'),
};

export const createItemSchema = z.object({
  ...listingFields,
  durationDays: z.coerce.number().int().min(MIN_DURATION_DAYS, 'Auction duration must be between 1 and 30 days').max(MAX_DURATION_DAYS, 'Auction duration must be between 1 and 30 days'),
});

const idList = z.preprocess(
  value => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
  z.array(z.coerce.number().int().positive())
);

export const updateItemSchema = z.object({ ...listingFields, removeImageIds: idList });

export const sellerItemsQuery = pageQuery.extend({
  status: z.enum(['all', 'pending', 'active', 'sold', 'expired', 'rejected']).default('all'),
});

export const analyticsQuery = z.object({ days: z.coerce.number().refine(value => [30, 90, 365].includes(value), 'Choose 30, 90 or 365 days').default(30) });

export const extendSchema = z.object({
  hours: z.coerce.number().int().min(1).max(MAX_EXTENSION_HOURS).default(24),
});

export const itemIdParams = z.object({ id: z.coerce.number().int().positive() });

const autoIncrement = (minBid: number): number => Math.max(1, Math.round(minBid * 5) / 100);

export const bidIncrementFor = (minBid: number, increment: 'auto' | number): number => (increment === 'auto' ? autoIncrement(minBid) : increment);
