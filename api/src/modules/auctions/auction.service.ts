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

interface PlacedBid {
  bid: BidRecord;
  previousLeaderId: number | null;
}

const recordBid = async (tx: Tx, itemId: number, bidderId: number, amount: number): Promise<PlacedBid> => {
  const previousLeader = await tx.bid.findFirst({ where: { itemId, isWinning: true } });
  await tx.bid.updateMany({ where: { itemId, isWinning: true }, data: { isWinning: false } });
  const bid = await tx.bid.create({ data: { itemId, bidderId, amount, isWinning: true }, include: bidInclude });
  await tx.item.update({ where: { id: itemId }, data: { currentPrice: amount, currentBidId: bid.id } });
  return { bid, previousLeaderId: previousLeader?.bidderId ?? null };
};

// Each round lets the strongest rival maximum answer the current leader. The
// higher maximum wins at one increment above the lower one; the lower maximum
// is shown in the ledger as the bid it stopped at.
const resolveProxies = async (tx: Tx, itemId: number): Promise<PlacedBid[]> => {
  const placed: PlacedBid[] = [];
  const caps = await tx.autoBid.findMany({ where: { itemId }, orderBy: [{ maxAmount: 'desc' }, { createdAt: 'asc' }] });
  for (let round = 0; round <= caps.length; round++) {
    const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
    const leader = await tx.bid.findFirstOrThrow({ where: { itemId, isWinning: true } });
    const price = Number(item.currentPrice);
    const step = Number(item.bidIncrement);
    const challenger = caps.find(cap => cap.userId !== leader.bidderId && Number(cap.maxAmount) >= price + step);
    if (!challenger) break;

    const leaderAuto = caps.find(cap => cap.userId === leader.bidderId);
    const leaderCap = Math.max(price, Number(leaderAuto?.maxAmount ?? 0));
    const challengerCap = Number(challenger.maxAmount);
    const challengerWins = challengerCap > leaderCap || (challengerCap === leaderCap && leaderAuto !== undefined && challenger.createdAt < leaderAuto.createdAt);
    const [winnerId, winnerCap, loserId, loserCap] =
      challengerWins ? [challenger.userId, challengerCap, leader.bidderId, leaderCap] : [leader.bidderId, leaderCap, challenger.userId, challengerCap];
    const finalPrice = Math.min(winnerCap, loserCap + step);
    if (finalPrice > loserCap && loserCap > price) placed.push(await recordBid(tx, itemId, loserId, loserCap));
    placed.push(await recordBid(tx, itemId, winnerId, finalPrice));
  }
  return placed;
};

const loadBiddableItem = async (tx: Tx, itemId: number, bidderId: number) => {
  await lockItem(tx, itemId);
  const item = await tx.item.findUnique({ where: { id: itemId } });
  if (!item) throw notFound('Item not found.');
  if (item.endDate <= new Date()) throw badRequest('This auction has ended.');
  if (item.status !== 'ACTIVE') throw badRequest('This auction is not active.');
  if (item.sellerId === bidderId) throw badRequest('You cannot bid on your own item.');
  return item;
};

const saveMaximum = (tx: Tx, itemId: number, userId: number, maxAmount: number) =>
  tx.autoBid.upsert({ where: { itemId_userId: { itemId, userId } }, create: { itemId, userId, maxAmount }, update: { maxAmount } });

const announce = async (itemId: number, bidderId: number, placed: PlacedBid[]) => {
  const item = await prisma.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { title: true, sellerId: true, currentPrice: true, currentBidId: true, minBid: true, bidIncrement: true, endDate: true },
  });
  const link = `/auctions/${itemId}`;
  const payloads = placed.map(({ bid }) => ({
    bid: bidDto(bid),
    currentPrice: money(bid.amount),
    nextMinimumBid: Number(bid.amount) + Number(item.bidIncrement),
    endDate: item.endDate,
  }));
  payloads.forEach(payload => emitToAuction(itemId, 'bid:placed', payload));

  for (const { bid, previousLeaderId } of placed) {
    if (previousLeaderId && previousLeaderId !== bid.bidderId) {
      await notify({ userId: previousLeaderId, title: 'You have been outbid', message: `Someone bid ${usd(bid.amount)} on "${item.title}".`, link });
    }
  }
  await notify({ userId: item.sellerId, title: 'New bid on your item', message: `"${item.title}" received a bid of ${usd(item.currentPrice)}.`, link });

  return {
    bid: payloads[payloads.length - 1]!.bid,
    currentPrice: money(item.currentPrice),
    nextMinimumBid: nextMinimumBid(item),
    endDate: item.endDate,
    leading: placed[placed.length - 1]!.bid.bidderId === bidderId,
  };
};

export const placeBid = async (itemId: number, bidderId: number, amount: number, maxAmount?: number) => {
  if (maxAmount !== undefined && maxAmount < amount) throw badRequest('Your maximum must be at least your bid.');
  const placed = await prisma.$transaction(async tx => {
    const item = await loadBiddableItem(tx, itemId, bidderId);
    const minimum = nextMinimumBid(item);
    if (amount < minimum) throw badRequest(`Bid must be at least ${usd(minimum)}.`);

    const ownBest = await tx.bid.findFirst({ where: { itemId, bidderId }, orderBy: { amount: 'desc' } });
    if (ownBest && Number(ownBest.amount) >= amount) {
      throw badRequest(`You already have a higher bid of ${usd(ownBest.amount)}.`);
    }

    const manual = await recordBid(tx, itemId, bidderId, amount);
    if (maxAmount !== undefined && maxAmount > amount) await saveMaximum(tx, itemId, bidderId, maxAmount);
    return [manual, ...(await resolveProxies(tx, itemId))];
  });
  return announce(itemId, bidderId, placed);
};

export const raiseMaximum = async (itemId: number, bidderId: number, maxAmount: number) => {
  const placed = await prisma.$transaction(async tx => {
    const item = await loadBiddableItem(tx, itemId, bidderId);
    const leader = await tx.bid.findFirst({ where: { itemId, isWinning: true } });
    if (leader?.bidderId !== bidderId) {
      const minimum = nextMinimumBid(item);
      if (maxAmount < minimum) throw badRequest(`Your maximum must be at least ${usd(minimum)}.`);
      const manual = await recordBid(tx, itemId, bidderId, minimum);
      if (maxAmount > minimum) await saveMaximum(tx, itemId, bidderId, maxAmount);
      return [manual, ...(await resolveProxies(tx, itemId))];
    }

    const current = await tx.autoBid.findUnique({ where: { itemId_userId: { itemId, userId: bidderId } } });
    const floor = Math.max(Number(item.currentPrice), Number(current?.maxAmount ?? 0));
    if (maxAmount <= floor) throw badRequest(`Your maximum must be higher than ${usd(floor)}.`);
    await saveMaximum(tx, itemId, bidderId, maxAmount);
    return resolveProxies(tx, itemId);
  });
  if (placed.length === 0) return { leading: true, maxAmount };
  return { ...(await announce(itemId, bidderId, placed)), maxAmount };
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
