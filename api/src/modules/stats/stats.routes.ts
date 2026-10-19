import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

export const statsRouter = Router();

statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const [activeAuctions, endingSoon, totalBids, members, soldItems] = await Promise.all([
      prisma.item.count({ where: { status: 'ACTIVE', endDate: { gt: now } } }),
      prisma.item.count({ where: { status: 'ACTIVE', endDate: { gt: now, lte: new Date(now.getTime() + DAY_MS) } } }),
      prisma.bid.count(),
      prisma.user.count({ where: { isBlocked: false } }),
      prisma.item.count({ where: { status: 'SOLD' } }),
    ]);
    res.json({ data: { activeAuctions, endingSoon, totalBids, members, soldItems } });
  })
);
