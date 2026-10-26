export type ItemStatus = 'draft' | 'pending' | 'active' | 'sold' | 'expired' | 'rejected';
export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  activeItems: number;
  children?: Category[];
}

export interface ListItem {
  id: number;
  title: string;
  description: string;
  category: { id: number; name: string } | null;
  status: ItemStatus;
  minBid: number;
  bidIncrement: number;
  currentPrice: number;
  hasBids: boolean;
  bidCount: number;
  watcherCount: number;
  featured: boolean;
  condition: string | null;
  seller: { id: number; username: string; rating?: number | null; createdAt?: string };
  startDate: string;
  endDate: string;
  primaryImage: string | null;
}

export interface Bid {
  id: number;
  itemId: number;
  bidderId: number;
  bidderName: string;
  amount: number;
  bidTime: string;
  isWinning: boolean;
}

export interface ItemDetail extends ListItem {
  nextMinimumBid: number;
  images: { id: number; url: string; isPrimary: boolean }[];
  documents: { id: number; fileName: string; url: string }[];
  seller: { id: number; username: string; avatarUrl: string | null; createdAt?: string };
  viewCount: number;
  winnerId: number | null;
  paid: boolean;
  createdAt: string;
  categoryId?: number | null;
  sellerRating: { average: number | null; count: number };
  rejectionReason: string | null;
  recentBids: Bid[];
  viewer: { isSeller: boolean; isWatching: boolean; myHighestBid: number | null; myMaxBid: number | null; isLeading: boolean; isWinner: boolean } | null;
}

export interface BidPlaced {
  bid: Bid;
  currentPrice: number;
  nextMinimumBid: number;
  endDate: string;
}

export interface AuctionEnded {
  itemId: number;
  status: ItemStatus;
  winningBid: Bid | null;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}
