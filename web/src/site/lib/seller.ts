import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { ItemDetail, ItemStatus, ListItem } from './types';

export type StatusFilter = 'all' | ItemStatus;

export interface SellerItem extends ListItem {
  rejectionReason: string | null;
  paid: boolean;
  viewCount: number;
}

export interface DailyEarning {
  day: string;
  earnings: number;
  itemsSold: number;
}

export interface SellerAnalytics {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  draftListings: number;
  rejectedListings: number;
  expiredListings: number;
  soldItems: number;
  totalEarnings: number;
  totalViews: number;
  averageSellingPrice: number;
  conversionRate: number;
  dailyEarnings: DailyEarning[];
  topCategories: { name: string; count: number }[];
  recentSales: ListItem[];
}

export const statusLabels: Record<StatusFilter, string> = { all: 'All', draft: 'Drafts', active: 'Live', pending: 'Pending', sold: 'Sold', expired: 'Unsold', rejected: 'Rejected' };

export const statusFilters = Object.keys(statusLabels) as StatusFilter[];

export const analyticsRanges = [
  { key: '30', label: '30D', summary: 'last 30 days', bucketDays: 1, tick: { month: 'short', day: 'numeric' } },
  { key: '90', label: '90D', summary: 'last 90 days', bucketDays: 7, tick: { month: 'short', day: 'numeric' } },
  { key: '365', label: '1Y', summary: 'last 12 months', bucketDays: 30, tick: { month: 'short', year: 'numeric' } },
] as const satisfies readonly { key: string; label: string; summary: string; bucketDays: number; tick: Intl.DateTimeFormatOptions }[];

export type AnalyticsRange = (typeof analyticsRanges)[number];

export const useSellerAnalytics = (days: AnalyticsRange['key']) =>
  useQuery({ queryKey: ['seller', 'analytics', days], queryFn: () => api.get<SellerAnalytics>(`/seller/analytics?days=${days}`) });

export const useSellerItem = (id: number | undefined) => useQuery({ queryKey: ['seller', 'item', id], queryFn: () => api.get<ItemDetail>(`/seller/items/${id}`), enabled: id !== undefined });

export const invalidateSeller = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ['seller'] });

export const countsOf = (analytics: SellerAnalytics): Record<StatusFilter, number> => ({
  all: analytics.totalListings,
  draft: analytics.draftListings,
  active: analytics.activeListings,
  pending: analytics.pendingListings,
  sold: analytics.soldItems,
  expired: analytics.expiredListings,
  rejected: analytics.rejectedListings,
});

export const formatDay = (day: string, options: Intl.DateTimeFormatOptions): string => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

export const formatDate = (value: string): string => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatWholeMoney = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`;

export const CONDITIONS = ['Mint', 'Excellent', 'Very good', 'Good', 'Fair'] as const;
export const DURATIONS = [3, 5, 7, 10] as const;
export const INCREMENT_PRESETS = [25, 50, 100, 250] as const;
export type Increment = 'auto' | (typeof INCREMENT_PRESETS)[number];

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const autoIncrement = (minBid: number): number => Math.max(1, Math.round(minBid * 5) / 100);

export const durationDaysOf = (item: Pick<ListItem, 'startDate' | 'endDate'>): number => Math.max(1, Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 86_400_000));
