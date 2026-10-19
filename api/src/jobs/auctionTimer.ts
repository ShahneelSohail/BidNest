import { prisma } from '../lib/prisma';
import { closeEndedAuctions } from '../modules/auctions/auction.service';
import { emitToAuction } from '../realtime/hub';

export const REMINDER_MINUTES = [30, 15, 5, 1];
const TICK_MS = 60 * 1000;
const WINDOW_MINUTES = 0.5;
const MS_PER_MINUTE = 60 * 1000;

export const runAuctionTick = async (now = new Date()) => {
  const closed = await closeEndedAuctions(now);

  const endingSoon = await prisma.item.findMany({
    where: { status: 'ACTIVE', endDate: { gt: now, lte: new Date(now.getTime() + (REMINDER_MINUTES[0] ?? 30) * MS_PER_MINUTE) } },
    select: { id: true, endDate: true },
  });

  let reminded = 0;
  for (const item of endingSoon) {
    const minutesLeft = (item.endDate.getTime() - now.getTime()) / MS_PER_MINUTE;
    const interval = REMINDER_MINUTES.find(minutes => Math.abs(minutesLeft - minutes) < WINDOW_MINUTES);
    if (interval) {
      emitToAuction(item.id, 'auction:ending', { itemId: item.id, minutesLeft: interval, endDate: item.endDate });
      reminded += 1;
    }
  }
  return { closed, reminded };
};

export const startAuctionTimer = (): (() => void) => {
  const timer = setInterval(() => {
    runAuctionTick().catch(error => console.error('Auction timer failed', error));
  }, TICK_MS);
  return () => clearInterval(timer);
};
