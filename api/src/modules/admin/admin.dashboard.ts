import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';

const ACTIVITY_BIDS = 8;
const ACTIVITY_USERS = 5;
const ACTIVITY_ITEMS = 5;
const ACTIVITY_LIMIT = 12;
const HOUR_MS = 60 * 60 * 1000;
const CHART_HOURS = 24;

export const dashboardRouter = Router();

dashboardRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const [users, blocked, itemGroups, liveAuctions, totalBids, revenue, newMessages, bids, newUsers, newItems, recentBidTimes] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.item.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.item.count({ where: { status: 'ACTIVE', endDate: { gt: now } } }),
      prisma.bid.count(),
      prisma.item.aggregate({ where: { status: 'SOLD' }, _sum: { currentPrice: true } }),
      prisma.contactMessage.count({ where: { status: 'NEW' } }),
      prisma.bid.findMany({ orderBy: { bidTime: 'desc' }, take: ACTIVITY_BIDS, include: { bidder: { select: { username: true } }, item: { select: { id: true, title: true } } } }),
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: ACTIVITY_USERS, select: { id: true, username: true, createdAt: true } }),
      prisma.item.findMany({ orderBy: { createdAt: 'desc' }, take: ACTIVITY_ITEMS, select: { id: true, title: true, createdAt: true, seller: { select: { username: true } } } }),
      prisma.bid.findMany({ where: { bidTime: { gte: new Date(now.getTime() - CHART_HOURS * HOUR_MS) } }, select: { bidTime: true } }),
    ]);
    const countOf = (status: string) => itemGroups.find(group => group.status === status)?._count._all ?? 0;

    const hoursAgo = (time: Date) => Math.floor((now.getTime() - time.getTime()) / HOUR_MS);
    const bidsPerHour = Array.from({ length: CHART_HOURS }, (_, index) => recentBidTimes.filter(({ bidTime }) => hoursAgo(bidTime) === CHART_HOURS - 1 - index).length);

    const activity = [
      ...bids.map(bid => ({ type: 'bid', description: `New bid on ${bid.item.title}`, user: bid.bidder.username, amount: money(bid.amount), link: `/auctions/${bid.item.id}`, at: bid.bidTime })),
      ...newUsers.map(user => ({ type: 'user', description: 'New user registered', user: user.username, amount: null, link: '/admin/users', at: user.createdAt })),
      ...newItems.map(item => ({ type: 'item', description: `New listing: ${item.title}`, user: item.seller.username, amount: null, link: '/admin/approvals', at: item.createdAt })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, ACTIVITY_LIMIT);

    res.json({
      data: {
        stats: {
          totalUsers: users,
          blockedUsers: blocked,
          liveAuctions,
          pendingApprovals: countOf('PENDING'),
          soldItems: countOf('SOLD'),
          expiredItems: countOf('EXPIRED'),
          rejectedItems: countOf('REJECTED'),
          totalBids,
          totalRevenue: money(revenue._sum.currentPrice) ?? 0,
          newMessages,
        },
        activity,
        bidsPerHour,
      },
    });
  })
);
