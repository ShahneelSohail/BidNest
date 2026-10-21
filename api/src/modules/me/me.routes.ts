import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http';
import { pageMeta, pageQuery, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { listInclude, toListItem } from '../items/item.dto';
import { wonWhere } from './won';

const RECENT_LIMIT = 5;

const bidsQuery = pageQuery.extend({ filter: z.enum(['all', 'active', 'leading', 'won', 'lost']).default('all') });
const idParams = z.object({ id: z.coerce.number().int().positive() });
const ratingSchema = z.object({
  score: z.coerce.number().int().min(1, 'Choose a rating from 1 to 5').max(5, 'Choose a rating from 1 to 5'),
  comment: z.string().trim().max(1000).optional(),
});
const notificationsQuery = pageQuery.extend({ unread: z.enum(['true', 'false']).default('false') });

type BidsQuery = z.infer<typeof bidsQuery>;
type Params = z.infer<typeof idParams>;


export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const now = new Date();
    const [activeBids, leading, won, watching, unread, recent] = await Promise.all([
      prisma.item.count({ where: { status: 'ACTIVE', endDate: { gt: now }, bids: { some: { bidderId: userId } } } }),
      prisma.item.count({ where: { status: 'ACTIVE', endDate: { gt: now }, currentBid: { is: { bidderId: userId } } } }),
      prisma.item.count({ where: wonWhere(userId) }),
      prisma.watchlist.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.item.findMany({ where: { status: 'ACTIVE', endDate: { gt: now }, bids: { some: { bidderId: userId } } }, include: listInclude, orderBy: { endDate: 'asc' }, take: RECENT_LIMIT }),
    ]);
    res.json({ data: { stats: { activeBids, leading, won, watching, unreadNotifications: unread }, endingSoon: recent.map(toListItem) } });
  })
);

meRouter.get(
  '/bids',
  validate('query', bidsQuery),
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const query = req.query as unknown as BidsQuery;
    const now = new Date();
    const live = { status: 'ACTIVE' as const, endDate: { gt: now } };
    const filters = {
      all: {},
      active: live,
      leading: { ...live, currentBid: { is: { bidderId: userId } } },
      won: wonWhere(userId),
      lost: { status: { in: ['SOLD', 'EXPIRED'] as ('SOLD' | 'EXPIRED')[] }, NOT: wonWhere(userId) },
    } satisfies Record<BidsQuery['filter'], object>;
    const where = { bids: { some: { bidderId: userId } }, ...filters[query.filter] };

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: { ...listInclude, bids: { where: { bidderId: userId }, orderBy: { amount: 'desc' }, take: 1 }, currentBid: { select: { bidderId: true } } },
        orderBy: { endDate: 'desc' },
        ...paginate(query),
      }),
      prisma.item.count({ where }),
    ]);
    res.json({
      data: items.map(item => ({
        ...toListItem(item),
        myHighestBid: money(item.bids[0]?.amount),
        isLeading: item.currentBid?.bidderId === userId,
        isWinner: item.status === 'SOLD' && item.currentBid?.bidderId === userId,
        paid: item.paidAt !== null,
      })),
      meta: pageMeta(query.page, query.pageSize, total),
    });
  })
);

meRouter.get(
  '/won',
  asyncHandler(async (req, res) => {
    const items = await prisma.item.findMany({
      where: wonWhere(currentUser(req).id),
      include: { ...listInclude, seller: { select: { id: true, username: true } }, ratings: { where: { raterId: currentUser(req).id }, take: 1 } },
      orderBy: { endDate: 'desc' },
    });
    res.json({
      data: items.map(item => ({
        ...toListItem(item),
        seller: item.seller,
        paid: item.paidAt !== null,
        paidAt: item.paidAt,
        myRating: item.ratings[0] ? { score: item.ratings[0].score, comment: item.ratings[0].comment } : null,
      })),
    });
  })
);

meRouter.post(
  '/won/:id/rating',
  validate('params', idParams),
  validate('body', ratingSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const userId = currentUser(req).id;
    const item = await prisma.item.findFirst({ where: { id, ...wonWhere(userId) } });
    if (!item) throw notFound('Won auction not found.');
    if (!item.paidAt) throw badRequest('Pay for the item before rating the seller.');
    if (await prisma.rating.findUnique({ where: { raterId_itemId: { raterId: userId, itemId: id } } })) throw conflict('You already rated this seller.');

    const rating = await prisma.rating.create({ data: { raterId: userId, ratedUserId: item.sellerId, itemId: id, score: req.body.score, comment: req.body.comment || null } });
    res.status(201).json({ data: { id: rating.id, score: rating.score, comment: rating.comment } });
  })
);

meRouter.get(
  '/watchlist',
  validate('query', pageQuery),
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const query = req.query as unknown as z.infer<typeof pageQuery>;
    const [entries, total] = await Promise.all([
      prisma.watchlist.findMany({ where: { userId }, orderBy: { addedAt: 'desc' }, include: { item: { include: listInclude } }, ...paginate(query) }),
      prisma.watchlist.count({ where: { userId } }),
    ]);
    res.json({ data: entries.map(entry => ({ ...toListItem(entry.item), addedAt: entry.addedAt })), meta: pageMeta(query.page, query.pageSize, total) });
  })
);

meRouter.get(
  '/notifications',
  validate('query', notificationsQuery),
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const query = req.query as unknown as z.infer<typeof notificationsQuery>;
    const where = { userId, ...(query.unread === 'true' ? { isRead: false } : {}) };
    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(query) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    res.json({ data: notifications, meta: { ...pageMeta(query.page, query.pageSize, total), unread } });
  })
);

meRouter.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: currentUser(req).id, isRead: false }, data: { isRead: true } });
    res.status(204).end();
  })
);

meRouter.patch(
  '/notifications/:id/read',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const { count } = await prisma.notification.updateMany({ where: { id, userId: currentUser(req).id }, data: { isRead: true } });
    if (!count) throw notFound('Notification not found.');
    res.status(204).end();
  })
);

meRouter.delete(
  '/notifications/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await prisma.notification.deleteMany({ where: { id, userId: currentUser(req).id } });
    res.status(204).end();
  })
);

meRouter.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const messages = await prisma.contactMessage.findMany({ where: { userId: currentUser(req).id }, orderBy: { createdAt: 'desc' } });
    res.json({
      data: messages.map(message => ({
        id: message.id,
        subject: message.subject,
        message: message.message,
        status: message.status.toLowerCase(),
        adminReply: message.adminReply,
        repliedAt: message.repliedAt,
        createdAt: message.createdAt,
      })),
    });
  })
);
