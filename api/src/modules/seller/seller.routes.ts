import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import type { z } from 'zod';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http';
import { pageMeta, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { imageUpload, removeUploads, uploadedPath, MAX_IMAGES_PER_ITEM } from '../../lib/upload';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { closeAuction } from '../auctions/auction.service';
import { detailInclude, listInclude, toDetailItem, toListItem } from '../items/item.dto';
import { analyticsQuery, createItemSchema, extendSchema, itemIdParams, sellerItemsQuery, updateItemSchema, bidIncrementFor } from './seller.schemas';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MONTHS_IN_ANALYTICS = 12;
const TOP_CATEGORIES = 5;
const RECENT_LIMIT = 8;

type Params = z.infer<typeof itemIdParams>;
type CreateBody = z.infer<typeof createItemSchema>;
type UpdateBody = z.infer<typeof updateItemSchema>;
type ItemsQuery = z.infer<typeof sellerItemsQuery>;

const uploadedFiles = (req: Request): Express.Multer.File[] => (req.files as Express.Multer.File[] | undefined) ?? [];

const ownItem = async (itemId: number, sellerId: number) => {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw notFound('Item not found.');
  if (item.sellerId !== sellerId) throw forbidden("You don't have permission to change this item.");
  return item;
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const dailySeries = (sold: { endDate: Date; currentPrice: Prisma.Decimal }[], days: number) => {
  const totals = new Map<string, number>();
  for (const item of sold) totals.set(dayKey(item.endDate), (totals.get(dayKey(item.endDate)) ?? 0) + Number(item.currentPrice));
  return Array.from({ length: days }, (_, index) => {
    const day = dayKey(new Date(Date.now() - (days - 1 - index) * MS_PER_DAY));
    return { day, earnings: totals.get(day) ?? 0 };
  });
};

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const sellerRouter = Router();
sellerRouter.use(requireAuth);

sellerRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const sellerId = currentUser(req).id;
    const [active, pending, sold, recentBids] = await Promise.all([
      prisma.item.findMany({ where: { sellerId, status: 'ACTIVE' }, include: listInclude, orderBy: { endDate: 'asc' }, take: RECENT_LIMIT }),
      prisma.item.findMany({ where: { sellerId, status: 'PENDING' }, include: listInclude, orderBy: { createdAt: 'desc' }, take: RECENT_LIMIT }),
      prisma.item.findMany({ where: { sellerId, status: 'SOLD' }, include: listInclude, orderBy: { endDate: 'desc' } }),
      prisma.bid.findMany({
        where: { item: { sellerId } },
        orderBy: { bidTime: 'desc' },
        take: RECENT_LIMIT,
        include: { bidder: { select: { username: true } }, item: { select: { id: true, title: true } } },
      }),
    ]);
    const counts = await prisma.item.groupBy({ by: ['status'], where: { sellerId }, _count: { _all: true } });
    const countOf = (status: string) => counts.find(entry => entry.status === status)?._count._all ?? 0;
    const totalEarnings = sold.reduce((sum, item) => sum + Number(item.currentPrice), 0);

    res.json({
      data: {
        stats: {
          activeListings: countOf('ACTIVE'),
          pendingListings: countOf('PENDING'),
          soldItems: countOf('SOLD'),
          totalEarnings,
          averageSellingPrice: sold.length ? totalEarnings / sold.length : 0,
        },
        activeListings: active.map(toListItem),
        pendingListings: pending.map(toListItem),
        recentSales: sold.slice(0, RECENT_LIMIT).map(toListItem),
        recentBids: recentBids.map(bid => ({
          id: bid.id,
          itemId: bid.item.id,
          itemTitle: bid.item.title,
          bidderName: bid.bidder.username,
          amount: money(bid.amount),
          bidTime: bid.bidTime,
          isWinning: bid.isWinning,
        })),
      },
    });
  })
);

sellerRouter.get(
  '/items',
  validate('query', sellerItemsQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ItemsQuery;
    const where = { sellerId: currentUser(req).id, ...(query.status === 'all' ? {} : { status: query.status.toUpperCase() as 'PENDING' }) };
    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, include: listInclude, orderBy: { createdAt: 'desc' }, ...paginate(query) }),
      prisma.item.count({ where }),
    ]);
    res.json({
      data: items.map(item => ({ ...toListItem(item), rejectionReason: item.rejectionReason, paid: item.paidAt !== null })),
      meta: pageMeta(query.page, query.pageSize, total),
    });
  })
);

sellerRouter.get(
  '/items/:id',
  validate('params', itemIdParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await ownItem(id, currentUser(req).id);
    const item = await prisma.item.findUniqueOrThrow({ where: { id }, include: detailInclude });
    res.json({ data: { ...toDetailItem(item), rejectionReason: item.rejectionReason, categoryId: item.categoryId } });
  })
);

sellerRouter.post(
  '/items',
  imageUpload.array('images', MAX_IMAGES_PER_ITEM),
  validate('body', createItemSchema),
  asyncHandler(async (req, res) => {
    const files = uploadedFiles(req);
    const { title, description, categoryId, minBid, durationDays, condition, increment } = req.body as CreateBody;
    try {
      if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, isActive: true } }))) {
        throw badRequest('Choose a valid category.');
      }
      const now = Date.now();
      const item = await prisma.item.create({
        data: {
          sellerId: currentUser(req).id,
          title,
          description,
          categoryId,
          condition,
          minBid,
          currentPrice: minBid,
          bidIncrement: bidIncrementFor(minBid, increment),
          startDate: new Date(now),
          endDate: new Date(now + durationDays * MS_PER_DAY),
          status: 'PENDING',
          images: { create: files.map((file, index) => ({ url: uploadedPath(file), isPrimary: index === 0 })) },
        },
        include: detailInclude,
      });
      res.status(201).json({ data: toDetailItem(item) });
    } catch (error) {
      await removeUploads(files.map(uploadedPath));
      throw error;
    }
  })
);

sellerRouter.patch(
  '/items/:id',
  imageUpload.array('images', MAX_IMAGES_PER_ITEM),
  validate('params', itemIdParams),
  validate('body', updateItemSchema),
  asyncHandler(async (req, res) => {
    const files = uploadedFiles(req);
    const { id } = req.params as unknown as Params;
    const { title, description, categoryId, minBid, removeImageIds, condition, increment } = req.body as UpdateBody;
    try {
      const item = await ownItem(id, currentUser(req).id);
      if (item.status !== 'PENDING') throw badRequest('You can only edit items that are pending approval.');
      if (categoryId && !(await prisma.category.findFirst({ where: { id: categoryId, isActive: true } }))) {
        throw badRequest('Choose a valid category.');
      }

      const doomed = await prisma.itemImage.findMany({ where: { itemId: id, id: { in: removeImageIds } } });
      const remaining = await prisma.itemImage.count({ where: { itemId: id } });
      const hasPrimary = (await prisma.itemImage.count({ where: { itemId: id, isPrimary: true, id: { notIn: doomed.map(image => image.id) } } })) > 0;
      if (remaining - doomed.length + files.length > MAX_IMAGES_PER_ITEM) throw badRequest(`An item can have at most ${MAX_IMAGES_PER_ITEM} images.`);

      await prisma.$transaction([
        prisma.itemImage.deleteMany({ where: { id: { in: doomed.map(image => image.id) } } }),
        prisma.item.update({
          where: { id },
          data: {
            title,
            description,
            categoryId,
            condition,
            minBid,
            currentPrice: minBid,
            bidIncrement: bidIncrementFor(minBid, increment),
            images: { create: files.map((file, index) => ({ url: uploadedPath(file), isPrimary: !hasPrimary && index === 0 })) },
          },
        }),
      ]);
      await removeUploads(doomed.map(image => image.url));

      const updated = await prisma.item.findUniqueOrThrow({ where: { id }, include: detailInclude });
      const needsPrimary = updated.images.length > 0 && !updated.images.some(image => image.isPrimary);
      if (needsPrimary) await prisma.itemImage.update({ where: { id: updated.images[0]!.id }, data: { isPrimary: true } });
      res.json({ data: toDetailItem(await prisma.item.findUniqueOrThrow({ where: { id }, include: detailInclude })) });
    } catch (error) {
      await removeUploads(files.map(uploadedPath));
      throw error;
    }
  })
);

sellerRouter.delete(
  '/items/:id',
  validate('params', itemIdParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await ownItem(id, currentUser(req).id);
    if ((await prisma.bid.count({ where: { itemId: id } })) > 0) throw badRequest('Cannot delete an item that has received bids.');

    const images = await prisma.itemImage.findMany({ where: { itemId: id } });
    await prisma.item.delete({ where: { id: item.id } });
    await removeUploads(images.map(image => image.url));
    res.status(204).end();
  })
);

sellerRouter.post(
  '/items/:id/extend',
  validate('params', itemIdParams),
  validate('body', extendSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await ownItem(id, currentUser(req).id);
    if (item.status !== 'ACTIVE' && item.status !== 'EXPIRED') throw badRequest('Only live or expired auctions can be extended.');

    const base = Math.max(item.endDate.getTime(), Date.now());
    const updated = await prisma.item.update({
      where: { id },
      data: { endDate: new Date(base + req.body.hours * MS_PER_HOUR), status: 'ACTIVE' },
      include: listInclude,
    });
    res.json({ data: toListItem(updated) });
  })
);

sellerRouter.post(
  '/items/:id/expire',
  validate('params', itemIdParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await ownItem(id, currentUser(req).id);
    if (item.status !== 'ACTIVE') throw badRequest('Only live auctions can be ended early.');

    await prisma.item.update({ where: { id }, data: { endDate: new Date(Date.now() - 1000) } });
    await closeAuction(id);
    const closed = await prisma.item.findUniqueOrThrow({ where: { id }, include: listInclude });
    res.json({ data: toListItem(closed) });
  })
);

sellerRouter.get(
  '/analytics',
  validate('query', analyticsQuery),
  asyncHandler(async (req, res) => {
    const sellerId = currentUser(req).id;
    const { days } = req.query as unknown as z.infer<typeof analyticsQuery>;
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - (MONTHS_IN_ANALYTICS - 1), 1);
    since.setUTCHours(0, 0, 0, 0);

    const [items, soldItems] = await Promise.all([
      prisma.item.findMany({ where: { sellerId }, select: { status: true, categoryId: true, category: { select: { name: true } } } }),
      prisma.item.findMany({
        where: { sellerId, status: 'SOLD' },
        include: listInclude,
        orderBy: { endDate: 'desc' },
      }),
    ]);

    const totalEarnings = soldItems.reduce((sum, item) => sum + Number(item.currentPrice), 0);
    const earningsByMonth = new Map<string, { earnings: number; itemsSold: number }>();
    for (const item of soldItems.filter(sold => sold.endDate >= since)) {
      const entry = earningsByMonth.get(monthKey(item.endDate)) ?? { earnings: 0, itemsSold: 0 };
      earningsByMonth.set(monthKey(item.endDate), { earnings: entry.earnings + Number(item.currentPrice), itemsSold: entry.itemsSold + 1 });
    }
    const monthlyEarnings = Array.from({ length: MONTHS_IN_ANALYTICS }, (_, index) => {
      const date = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + index, 1));
      return { month: monthKey(date), ...(earningsByMonth.get(monthKey(date)) ?? { earnings: 0, itemsSold: 0 }) };
    });

    const categoryTotals = new Map<string, number>();
    for (const item of items) {
      const name = item.category?.name ?? 'Uncategorised';
      categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + 1);
    }

    res.json({
      data: {
        totalListings: items.length,
        activeListings: items.filter(item => item.status === 'ACTIVE').length,
        pendingListings: items.filter(item => item.status === 'PENDING').length,
        soldItems: soldItems.length,
        totalEarnings,
        averageSellingPrice: soldItems.length ? totalEarnings / soldItems.length : 0,
        conversionRate: items.length ? (soldItems.length / items.length) * 100 : 0,
        monthlyEarnings,
        dailyEarnings: dailySeries(soldItems, days),
        topCategories: [...categoryTotals.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_CATEGORIES),
        recentSales: soldItems.slice(0, RECENT_LIMIT).map(toListItem),
      },
    });
  })
);
