import { Prisma, type ItemStatus } from '@prisma/client';
import { env } from '../../config/env';
import { money } from '../../lib/serialize';

export const imageUrl = (url: string): string => (url.startsWith('http') ? url : `${env.PUBLIC_API_URL}${url}`);

export const apiStatus = (status: ItemStatus) => status.toLowerCase() as Lowercase<ItemStatus>;

export const listInclude = {
  category: { select: { id: true, name: true } },
  images: { where: { isPrimary: true }, take: 1 },
  seller: { select: { id: true, username: true } },
  _count: { select: { bids: true, watchers: true } },
} satisfies Prisma.ItemInclude;

export const detailInclude = {
  category: { select: { id: true, name: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }] },
  documents: true,
  seller: { select: { id: true, username: true, createdAt: true } },
  currentBid: { select: { id: true, bidderId: true, amount: true } },
  _count: { select: { bids: true, watchers: true } },
} satisfies Prisma.ItemInclude;

type ListItem = Prisma.ItemGetPayload<{ include: typeof listInclude }>;
type DetailItem = Prisma.ItemGetPayload<{ include: typeof detailInclude }>;

interface BidPricing {
  currentPrice: Prisma.Decimal;
  currentBidId: number | null;
  minBid: Prisma.Decimal;
  bidIncrement: Prisma.Decimal;
}

export const nextMinimumBid = (item: BidPricing): number =>
  item.currentBidId === null ? Number(item.minBid) : Number(item.currentPrice) + Number(item.bidIncrement);

export const toListItem = (item: ListItem) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  category: item.category,
  status: apiStatus(item.status),
  minBid: money(item.minBid),
  bidIncrement: money(item.bidIncrement),
  currentPrice: money(item.currentPrice),
  hasBids: item.currentBidId !== null,
  bidCount: item._count.bids,
  watcherCount: item._count.watchers,
  featured: item.featured,
  condition: item.condition,
  seller: item.seller,
  startDate: item.startDate,
  endDate: item.endDate,
  primaryImage: item.images[0] ? imageUrl(item.images[0].url) : null,
});

export const toDetailItem = (item: DetailItem) => ({
  ...toListItem({ ...item, images: item.images.filter(image => image.isPrimary).slice(0, 1) }),
  nextMinimumBid: nextMinimumBid(item),
  images: item.images.map(image => ({ id: image.id, url: imageUrl(image.url), isPrimary: image.isPrimary })),
  documents: item.documents.map(doc => ({ id: doc.id, fileName: doc.fileName, url: imageUrl(doc.url) })),
  seller: item.seller,
  viewCount: item.viewCount,
  winnerId: item.status === 'SOLD' ? (item.currentBid?.bidderId ?? null) : null,
  paid: item.paidAt !== null,
  createdAt: item.createdAt,
});
