import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, conflict, forbidden, notFound } from '../../lib/http';
import { pageMeta, pageQuery, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const usersQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  blocked: z.enum(['true', 'false']).optional(),
});

type Params = z.infer<typeof idParams>;
type UsersQuery = z.infer<typeof usersQuery>;

const userCounts = { select: { items: true, bids: true, watchlist: true } } as const;

const findManagedUser = async (id: number) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User not found.');
  return user;
};

export const usersRouter = Router();

usersRouter.get(
  '/users',
  validate('query', usersQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as UsersQuery;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.blocked ? { isBlocked: query.blocked === 'true' } : {}),
      ...(query.q
        ? {
            OR: [
              { username: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
              { fullName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: { id: true, username: true, email: true, fullName: true, role: true, isBlocked: true, createdAt: true, _count: userCounts },
        ...paginate(query),
      }),
      prisma.user.count({ where }),
    ]);
    res.json({
      data: users.map(({ _count, ...user }) => ({ ...user, itemCount: _count.items, bidCount: _count.bids })),
      meta: pageMeta(query.page, query.pageSize, total),
    });
  })
);

usersRouter.get(
  '/users/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, fullName: true, role: true, isBlocked: true, createdAt: true, _count: userCounts },
    });
    if (!user) throw notFound('User not found.');

    const [recentBids, recentItems] = await Promise.all([
      prisma.bid.findMany({ where: { bidderId: id }, orderBy: { bidTime: 'desc' }, take: 10, include: { item: { select: { id: true, title: true } } } }),
      prisma.item.findMany({ where: { sellerId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, title: true, status: true, currentPrice: true } }),
    ]);
    const { _count, ...profile } = user;
    res.json({
      data: {
        ...profile,
        counts: { items: _count.items, bids: _count.bids, watchlist: _count.watchlist },
        recentBids: recentBids.map(bid => ({ id: bid.id, itemId: bid.item.id, itemTitle: bid.item.title, amount: Number(bid.amount), bidTime: bid.bidTime })),
        recentItems: recentItems.map(item => ({ id: item.id, title: item.title, status: item.status.toLowerCase(), currentPrice: Number(item.currentPrice) })),
      },
    });
  })
);

usersRouter.patch(
  '/users/:id/block',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const user = await findManagedUser(id);
    if (user.role === 'ADMIN') throw forbidden('Cannot block admin users.');

    const updated = await prisma.user.update({ where: { id }, data: { isBlocked: !user.isBlocked }, select: { id: true, isBlocked: true } });
    res.json({ data: updated });
  })
);

usersRouter.delete(
  '/users/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const user = await findManagedUser(id);
    if (user.role === 'ADMIN') throw forbidden('Cannot delete admin users.');

    const [items, bids] = await Promise.all([prisma.item.count({ where: { sellerId: id } }), prisma.bid.count({ where: { bidderId: id } })]);
    if (items > 0 || bids > 0) throw conflict('Cannot delete a user who has listings or bids. Block the account instead.');

    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  })
);
