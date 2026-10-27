import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound } from '../../lib/http';
import { pageMeta, pageQuery, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { removeUploads } from '../../lib/upload';
import { validate } from '../../middleware/validate';
import { bidDto, bidInclude } from '../auctions/auction.service';
import { detailInclude, listInclude, toDetailItem, toListItem } from '../items/item.dto';
import { notify } from '../notifications/notification.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 60 * 1000;
const REVIEW_TITLES = ['Your listing was approved', 'Your listing was not approved'];
const STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'SOLD', 'EXPIRED'] as const;

const idParams = z.object({ id: z.coerce.number().int().positive() });
const imageParams = z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() });
const optionalInt = z.preprocess(value => (value === '' ? undefined : value), z.coerce.number().int().optional());

const itemsQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  categoryId: optionalInt,
  status: z.enum(['all', ...STATUSES]).default('all'),
  sort: z.enum(['newest', 'ending', 'price', 'bids']).default('newest'),
});
const approvalsQuery = pageQuery.extend({ pageSize: z.coerce.number().int().min(1).max(60).default(10) });
const approveSchema = z.object({ adminNotes: z.string().trim().max(1000).optional() });
const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required').max(500),
  adminNotes: z.string().trim().max(1000).optional(),
});
const statusSchema = z.object({ status: z.enum(STATUSES) });
const extendSchema = z.object({ days: z.coerce.number().int().min(1).max(60) });
const bidsQuery = pageQuery.extend({ pageSize: z.coerce.number().int().min(1).max(60).default(20), q: z.string().trim().max(100).optional() });

type Params = z.infer<typeof idParams>;

const orderFor = (sort: z.infer<typeof itemsQuery>['sort']): Prisma.ItemOrderByWithRelationInput[] => {
  switch (sort) {
    case 'ending':
      return [{ endDate: 'asc' }];
    case 'price':
      return [{ currentPrice: 'desc' }];
    case 'bids':
      return [{ bids: { _count: 'desc' } }];
    default:
      return [{ createdAt: 'desc' }];
  }
};

const assertItem = async (id: number) => {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw notFound('Item not found.');
  return item;
};

const adminListItem = (item: Parameters<typeof toListItem>[0] & { seller: { id: number; username: string }; adminNotes: string | null; rejectionReason: string | null; createdAt: Date }) => ({
  ...toListItem(item),
  seller: item.seller,
  adminNotes: item.adminNotes,
  rejectionReason: item.rejectionReason,
  createdAt: item.createdAt,
});

const withSeller = { ...listInclude, seller: { select: { id: true, username: true } } } satisfies Prisma.ItemInclude;

export const itemsRouter = Router();

itemsRouter.get(
  '/items',
  validate('query', itemsQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof itemsQuery>;
    const where: Prisma.ItemWhereInput = {
      ...(query.status === 'all' ? { status: { not: 'DRAFT' as const } } : { status: query.status }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { seller: { username: { contains: query.q, mode: 'insensitive' } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, include: withSeller, orderBy: orderFor(query.sort), ...paginate(query) }),
      prisma.item.count({ where }),
    ]);
    res.json({ data: items.map(adminListItem), meta: pageMeta(query.page, query.pageSize, total) });
  })
);

itemsRouter.get(
  '/items/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await prisma.item.findUnique({ where: { id }, include: detailInclude });
    if (!item) throw notFound('Item not found.');
    const bids = await prisma.bid.findMany({ where: { itemId: id }, orderBy: { bidTime: 'desc' }, include: bidInclude });
    res.json({ data: { ...toDetailItem(item), adminNotes: item.adminNotes, rejectionReason: item.rejectionReason, bids: bids.map(bidDto) } });
  })
);

itemsRouter.patch(
  '/items/:id/status',
  validate('params', idParams),
  validate('body', statusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await assertItem(id);
    const item = await prisma.item.update({ where: { id }, data: { status: req.body.status }, include: withSeller });
    res.json({ data: adminListItem(item) });
  })
);

itemsRouter.patch(
  '/items/:id/featured',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await assertItem(id);
    const updated = await prisma.item.update({ where: { id }, data: { featured: !item.featured }, select: { id: true, featured: true } });
    res.json({ data: updated });
  })
);

itemsRouter.post(
  '/items/:id/extend',
  validate('params', idParams),
  validate('body', extendSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await assertItem(id);
    if (item.status !== 'ACTIVE' && item.status !== 'EXPIRED') throw badRequest('Only live or expired auctions can be extended.');

    const base = Math.max(item.endDate.getTime(), Date.now());
    const updated = await prisma.item.update({
      where: { id },
      data: { endDate: new Date(base + req.body.days * MS_PER_DAY), status: 'ACTIVE' },
      include: withSeller,
    });
    res.json({ data: adminListItem(updated) });
  })
);

itemsRouter.delete(
  '/items/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await assertItem(id);
    const images = await prisma.itemImage.findMany({ where: { itemId: id } });
    await prisma.$transaction([prisma.item.update({ where: { id }, data: { currentBidId: null } }), prisma.item.delete({ where: { id } })]);
    await removeUploads(images.map(image => image.url));
    res.status(204).end();
  })
);

itemsRouter.delete(
  '/items/:id/images/:imageId',
  validate('params', imageParams),
  asyncHandler(async (req, res) => {
    const { id, imageId } = req.params as unknown as z.infer<typeof imageParams>;
    const image = await prisma.itemImage.findFirst({ where: { id: imageId, itemId: id } });
    if (!image) throw notFound('Image not found.');

    await prisma.itemImage.delete({ where: { id: imageId } });
    await removeUploads([image.url]);
    if (image.isPrimary) {
      const next = await prisma.itemImage.findFirst({ where: { itemId: id }, orderBy: { id: 'asc' } });
      if (next) await prisma.itemImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    res.status(204).end();
  })
);

itemsRouter.patch(
  '/items/:id/images/:imageId/primary',
  validate('params', imageParams),
  asyncHandler(async (req, res) => {
    const { id, imageId } = req.params as unknown as z.infer<typeof imageParams>;
    if (!(await prisma.itemImage.findFirst({ where: { id: imageId, itemId: id } }))) throw notFound('Image not found.');

    await prisma.$transaction([
      prisma.itemImage.updateMany({ where: { itemId: id }, data: { isPrimary: false } }),
      prisma.itemImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);
    res.status(204).end();
  })
);

itemsRouter.get(
  '/approvals',
  validate('query', approvalsQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof approvalsQuery>;
    const where = { status: 'PENDING' as const };
    const [items, total] = await Promise.all([
      prisma.item.findMany({ where, include: withSeller, orderBy: { createdAt: 'asc' }, ...paginate(query) }),
      prisma.item.count({ where }),
    ]);
    res.json({ data: items.map(adminListItem), meta: pageMeta(query.page, query.pageSize, total) });
  })
);

const pendingItem = async (id: number) => {
  const item = await assertItem(id);
  if (item.status !== 'PENDING') throw badRequest('Item not found or not pending approval.');
  return item;
};

itemsRouter.post(
  '/approvals/:id/approve',
  validate('params', idParams),
  validate('body', approveSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await pendingItem(id);
    const duration = item.endDate.getTime() - item.startDate.getTime();
    const now = Date.now();

    const approved = await prisma.item.update({
      where: { id },
      data: { status: 'ACTIVE', startDate: new Date(now), endDate: new Date(now + duration), adminNotes: req.body.adminNotes || null, rejectionReason: null, reviewedAt: new Date(now) },
      include: withSeller,
    });
    await notify({ userId: item.sellerId, title: 'Your listing was approved', message: `"${item.title}" is now live and open for bidding.`, link: `/auctions/${id}` });
    res.json({ data: adminListItem(approved) });
  })
);

itemsRouter.post(
  '/approvals/:id/reject',
  validate('params', idParams),
  validate('body', rejectSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await pendingItem(id);
    const { rejectionReason, adminNotes } = req.body as z.infer<typeof rejectSchema>;

    const rejected = await prisma.item.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason, adminNotes: adminNotes || null, reviewedAt: new Date() },
      include: withSeller,
    });
    await notify({ userId: item.sellerId, title: 'Your listing was not approved', message: `"${item.title}" was rejected: ${rejectionReason}`, link: '/sell' });
    res.json({ data: adminListItem(rejected) });
  })
);

itemsRouter.post(
  '/approvals/:id/undo',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const item = await assertItem(id);
    const withinWindow = item.reviewedAt !== null && Date.now() - item.reviewedAt.getTime() <= UNDO_WINDOW_MS;
    if ((item.status !== 'ACTIVE' && item.status !== 'REJECTED') || !withinWindow) throw badRequest('This decision can no longer be undone.');
    if ((await prisma.bid.count({ where: { itemId: id } })) > 0) throw badRequest('This listing already has bids, so the approval cannot be undone.');

    const reopened = await prisma.$transaction(async tx => {
      await tx.notification.deleteMany({ where: { userId: item.sellerId, title: { in: REVIEW_TITLES }, createdAt: { gte: item.reviewedAt! } } });
      return tx.item.update({ where: { id }, data: { status: 'PENDING', reviewedAt: null, rejectionReason: null, adminNotes: null }, include: withSeller });
    });
    res.json({ data: adminListItem(reopened) });
  })
);

itemsRouter.get(
  '/bids',
  validate('query', bidsQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof bidsQuery>;
    const where: Prisma.BidWhereInput = query.q
      ? { OR: [{ item: { title: { contains: query.q, mode: 'insensitive' } } }, { bidder: { username: { contains: query.q, mode: 'insensitive' } } }] }
      : {};
    const [bids, total] = await Promise.all([
      prisma.bid.findMany({
        where,
        orderBy: { bidTime: 'desc' },
        include: { ...bidInclude, item: { select: { id: true, title: true, status: true } } },
        ...paginate(query),
      }),
      prisma.bid.count({ where }),
    ]);
    res.json({
      data: bids.map(bid => ({ ...bidDto(bid), itemTitle: bid.item.title, itemStatus: bid.item.status.toLowerCase() })),
      meta: pageMeta(query.page, query.pageSize, total),
    });
  })
);
