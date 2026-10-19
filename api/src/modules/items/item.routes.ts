import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, conflict, notFound } from '../../lib/http';
import { pageMeta, pageQuery, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { currentUser, optionalAuth, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { bidDto, bidInclude, placeBid } from '../auctions/auction.service';
import { detailInclude, listInclude, toDetailItem, toListItem } from './item.dto';
import { buildItemOrder, buildItemWhere, itemsQuerySchema, type ItemsQuery } from './item.query';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const bidSchema = z.object({ amount: z.coerce.number().positive('Enter a bid amount') });
const suggestionQuery = z.object({ q: z.string().trim().min(1).max(100) });
const SUGGESTION_LIMIT = 8;
const RECENT_BIDS = 10;

export const itemRouter = Router();

itemRouter.get(
  '/',
  validate('query', itemsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ItemsQuery;
    const where = await buildItemWhere(query);
    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, orderBy: buildItemOrder(query.sort), include: listInclude, ...paginate(query) }),
      prisma.item.count({ where }),
    ]);
    res.json({ data: items.map(toListItem), meta: pageMeta(query.page, query.pageSize, total) });
  })
);

itemRouter.get(
  '/suggestions',
  validate('query', suggestionQuery),
  asyncHandler(async (req, res) => {
    const { q } = req.query as unknown as z.infer<typeof suggestionQuery>;
    const items = await prisma.item.findMany({
      where: { status: 'ACTIVE', endDate: { gt: new Date() }, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true },
      orderBy: { endDate: 'asc' },
      take: SUGGESTION_LIMIT,
    });
    res.json({ data: items });
  })
);

itemRouter.get(
  '/:id',
  optionalAuth,
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const item = await prisma.item.findUnique({ where: { id }, include: detailInclude });
    const viewer = req.user;
    const isPrivileged = viewer && (viewer.role === 'ADMIN' || viewer.id === item?.sellerId);
    if (!item || (!['ACTIVE', 'SOLD', 'EXPIRED'].includes(item.status) && !isPrivileged)) throw notFound('Item not found.');

    const [recentBids, watching, myBest, sellerRating] = await Promise.all([
      prisma.bid.findMany({ where: { itemId: id }, orderBy: [{ amount: 'desc' }, { bidTime: 'asc' }], take: RECENT_BIDS, include: bidInclude }),
      viewer ? prisma.watchlist.findUnique({ where: { userId_itemId: { userId: viewer.id, itemId: id } } }) : null,
      viewer ? prisma.bid.findFirst({ where: { itemId: id, bidderId: viewer.id }, orderBy: { amount: 'desc' } }) : null,
      prisma.rating.aggregate({ where: { ratedUserId: item.sellerId }, _avg: { score: true }, _count: { _all: true } }),
    ]);

    res.json({
      data: {
        ...toDetailItem(item),
        sellerRating: { average: sellerRating._avg.score, count: sellerRating._count._all },
        rejectionReason: isPrivileged ? item.rejectionReason : null,
        recentBids: recentBids.map(bidDto),
        viewer: viewer
          ? {
              isSeller: viewer.id === item.sellerId,
              isWatching: Boolean(watching),
              myHighestBid: money(myBest?.amount),
              isLeading: item.currentBid?.bidderId === viewer.id,
              isWinner: item.status === 'SOLD' && item.currentBid?.bidderId === viewer.id,
            }
          : null,
      },
    });
  })
);

itemRouter.get(
  '/:id/bids',
  validate('params', idParams),
  validate('query', pageQuery),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const query = req.query as unknown as z.infer<typeof pageQuery>;
    const where = { itemId: id };
    const [bids, total] = await Promise.all([
      prisma.bid.findMany({ where, orderBy: { bidTime: 'desc' }, include: bidInclude, ...paginate(query) }),
      prisma.bid.count({ where }),
    ]);
    res.json({ data: bids.map(bidDto), meta: pageMeta(query.page, query.pageSize, total) });
  })
);

itemRouter.post(
  '/:id/bids',
  requireAuth,
  validate('params', idParams),
  validate('body', bidSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const result = await placeBid(id, currentUser(req).id, req.body.amount);
    res.status(201).json({ data: result });
  })
);

itemRouter.put(
  '/:id/watch',
  requireAuth,
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const userId = currentUser(req).id;
    const item = await prisma.item.findUnique({ where: { id }, select: { sellerId: true } });
    if (!item) throw notFound('Item not found.');
    if (item.sellerId === userId) throw conflict('You cannot watch your own item.');

    await prisma.watchlist.upsert({ where: { userId_itemId: { userId, itemId: id } }, create: { userId, itemId: id }, update: {} });
    res.json({ data: { isWatching: true } });
  })
);

itemRouter.delete(
  '/:id/watch',
  requireAuth,
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    await prisma.watchlist.deleteMany({ where: { userId: currentUser(req).id, itemId: id } });
    res.json({ data: { isWatching: false } });
  })
);
