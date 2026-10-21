import type { Bid, ItemDetail, ItemStatus, ListItem, Role } from './types';
import type { PageMeta } from './api';

export interface AdminOverviewData {
  stats: {
    totalUsers: number;
    blockedUsers: number;
    liveAuctions: number;
    pendingApprovals: number;
    soldItems: number;
    expiredItems: number;
    rejectedItems: number;
    totalBids: number;
    totalRevenue: number;
    newMessages: number;
  };
  activity: { type: 'bid' | 'user' | 'item'; description: string; user: string; amount: number | null; link: string; at: string }[];
  bidsPerHour: number[];
}

export interface AdminItem extends ListItem {
  adminNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminItemDetail extends ItemDetail {
  seller: ItemDetail['seller'] & { createdAt: string };
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  isBlocked: boolean;
  createdAt: string;
  itemCount: number;
  bidCount: number;
}

export interface AdminUserDetail extends Omit<AdminUser, 'itemCount' | 'bidCount'> {
  counts: { items: number; bids: number; watchlist: number };
  recentBids: { id: number; itemId: number; itemTitle: string; amount: number; bidTime: string }[];
  recentItems: { id: number; title: string; status: ItemStatus; currentPrice: number }[];
}

export interface AdminCategory {
  id: number;
  name: string;
  parentId: number | null;
  isActive: boolean;
  itemCount: number;
  childCount: number;
}

export interface AdminBid extends Bid {
  itemTitle: string;
  itemStatus: ItemStatus;
}

export type MessageStatus = 'new' | 'read' | 'replied' | 'archived';

export interface AdminMessage {
  id: number;
  userId: number | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  adminReply: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
}

export type MessagesMeta = PageMeta & { counts: Partial<Record<MessageStatus, number>> };

const AGO_UNITS = [
  ['d', 86_400_000],
  ['h', 3_600_000],
  ['m', 60_000],
  ['s', 1000],
] as const;

export const formatAgo = (iso: string, now: number): string => {
  const elapsed = Math.max(0, now - Date.parse(iso));
  const unit = AGO_UNITS.find(([, ms]) => elapsed >= ms);
  return unit ? `${Math.floor(elapsed / unit[1])}${unit[0]}` : 'now';
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .replace(/[^a-z]/gi, '')
    .slice(0, 2)
    .toUpperCase();

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
export const formatMonthYear = (iso: string): string => monthYear.format(new Date(iso));
