import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { listInclude, toListItem } from '../items/item.dto';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const REVIEW_LIMIT = 10;
const LISTING_LIMIT = 12;

export const userRouter = Router();

userRouter.get(
  '/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, createdAt: true, isBlocked: true } });
    if (!user || user.isBlocked) throw notFound('User not found.');

    const [rating, reviews, listings, soldCount] = await Promise.all([
      prisma.rating.aggregate({ where: { ratedUserId: id }, _avg: { score: true }, _count: { _all: true } }),
      prisma.rating.findMany({
        where: { ratedUserId: id },
        orderBy: { createdAt: 'desc' },
        take: REVIEW_LIMIT,
        include: { rater: { select: { username: true } } },
      }),
      prisma.item.findMany({ where: { sellerId: id, status: 'ACTIVE', endDate: { gt: new Date() } }, include: listInclude, orderBy: { endDate: 'asc' }, take: LISTING_LIMIT }),
      prisma.item.count({ where: { sellerId: id, status: 'SOLD' } }),
    ]);

    res.json({
      data: {
        id: user.id,
        username: user.username,
        memberSince: user.createdAt,
        itemsSold: soldCount,
        rating: { average: rating._avg.score, count: rating._count._all },
        reviews: reviews.map(review => ({ id: review.id, score: review.score, comment: review.comment, author: review.rater.username, createdAt: review.createdAt })),
        listings: listings.map(toListItem),
      },
    });
  })
);
