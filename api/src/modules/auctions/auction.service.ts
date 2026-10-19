import { Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../lib/http';
import { prisma, type Tx } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { emitToAuction } from '../../realtime/hub';
import { nextMinimumBid } from '../items/item.dto';
import { notify } from '../notifications/notification.service';

interface BidRecord {
  id: number;
  itemId: number;
  bidderId: number;
  amount: Prisma.Decimal;
  bidTime: Date;
  isWinning: boolean;
  bidder: { username: string };
}

export const bidInclude = { bidder: { select: { username: true } } } satisfies Prisma.BidInclude;

export const bidDto = (bid: BidRecord) => ({
  id: bid.id,
  itemId: bid.itemId,
  bidderId: bid.bidderId,
  bidderName: bid.bidder.username,
  amount: money(bid.amount),
  bidTime: bid.bidTime,
  isWinning: bid.isWinning,
});

const usd = (value: number | Prisma.Decimal) => `$${Number(value).toFixed(2)}`;

const lockItem = async (tx: Tx, itemId: number) => {
  await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId} FOR UPDATE`;
};

export const placeBid = async (itemId: number, bidderId: number, amount: number) => {
  const result = await prisma.$transaction(async tx => {
    await lockItem(tx, itemId);
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw notFound('Item not found.');
    if (item.endDate <= new Date()) throw badRequest('This auction has ended.');
    if (item.status !== 'ACTIVE') throw badRequest('This auction is not active.');
    if (item.sellerId === bidderId) throw badRequest('You cannot bid on your own item.');

    const minimum = nextMinimumBid(item);
    if (amount < minimum) throw badRequest(`Bid must be at least ${usd(minimum)}.`);

    const ownBest = await tx.bid.findFirst({ where: { itemId, bidderId }, orderBy: { amount: 'desc' } });
    if (ownBest && Number(ownBest.amount) >= amount) {
      throw badRequest(`You already have a higher bid of ${usd(ownBest.amount)}.`);
    }

    const previousLeader = await tx.bid.findFirst({ where: { itemId, isWinning: true } });
    await tx.bid.updateMany({ where: { itemId, isWinning: true }, data: { isWinning: false } });
    const bid = await tx.bid.create({ data: { itemId, bidderId, amount, isWinning: true }, include: bidInclude });
    const updated = await tx.item.update({
      where: { id: itemId },
      data: { currentPrice: amount, currentBidId: bid.id },
      select: { title: true, sellerId: true, currentPrice: true, currentBidId: true, minBid: true, bidIncrement: true, endDate: true },
    });
    return { bid, item: updated, previousLeaderId: previousLeader?.bidderId ?? null };
  });

  const payload = {
    bid: bidDto(result.bid),
    currentPrice: money(result.item.currentPrice),
    nextMinimumBid: nextMinimumBid(result.item),
    endDate: result.item.endDate,
  };
  emitToAuction(itemId, 'bid:placed', payload);

  const link = `/auctions/${itemId}`;
  if (result.previousLeaderId && result.previousLeaderId !== bidderId) {
    await notify({
      userId: result.previousLeaderId,
      title: 'You have been outbid',
      message: `Someone bid ${usd(amount)} on "${result.item.title}".`,
      link,
    });
  }
  await notify({
    userId: result.item.sellerId,
    title: 'New bid on your item',
    message: `"${result.item.title}" received a bid of ${usd(amount)}.`,
    link,
  });

  return payload;
};

export const closeAuction = async (itemId: number) => {
  const outcome = await prisma.$transaction(async tx => {
    await lockItem(tx, itemId);
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item || item.status !== 'ACTIVE') return null;

    const winner = await tx.bid.findFirst({
      where: { itemId },
      orderBy: [{ amount: 'desc' }, { bidTime: 'asc' }],
      include: bidInclude,
    });
    const updated = await tx.item.update({
      where: { id: itemId },
      data: winner ? { status: 'SOLD', currentBidId: winner.id, currentPrice: winner.amount } : { status: 'EXPIRED' },
    });
    return { item: updated, winner };
  });
  if (!outcome) return null;

  const { item, winner } = outcome;
  const link = `/auctions/${itemId}`;
  emitToAuction(itemId, 'auction:ended', {
    itemId,
    status: item.status.toLowerCase(),
    winningBid: winner ? bidDto(winner) : null,
  });

  if (winner) {
    await notify({
      userId: winner.bidderId,
      title: 'You won the auction',
      message: `You won "${item.title}" for ${usd(winner.amount)}. Complete your payment to finish.`,
      link: '/dashboard/won',
    });
    await notify({ userId: item.sellerId, title: 'Your item sold', message: `"${item.title}" sold for ${usd(winner.amount)}.`, link });
  } else {
    await notify({
      userId: item.sellerId,
      title: 'Your auction ended without bids',
      message: `"${item.title}" expired with no bids. You can extend it from your dashboard.`,
      link,
    });
  }
  return outcome;
};

export const closeEndedAuctions = async (now = new Date()): Promise<number> => {
  const ended = await prisma.item.findMany({ where: { status: 'ACTIVE', endDate: { lte: now } }, select: { id: true } });
  const results = await Promise.all(ended.map(item => closeAuction(item.id)));
  return results.filter(Boolean).length;
};
