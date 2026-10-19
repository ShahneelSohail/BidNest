import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { corsOrigins } from '../config/env';
import { prisma } from '../lib/prisma';
import { AUTH_COOKIE, readCookie, verifyToken } from '../lib/tokens';
import { nextMinimumBid } from '../modules/items/item.dto';
import { attachHub, auctionRoom, userRoom } from './hub';

const joinSchema = z.object({ itemId: z.coerce.number().int().positive() });

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, { cors: { origin: corsOrigins, credentials: true } });

  io.use(async (socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, AUTH_COOKIE);
    const userId = token ? verifyToken(token) : null;
    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isBlocked: true } }) : null;
    socket.data.userId = user && !user.isBlocked ? user.id : null;
    next();
  });

  io.on('connection', socket => {
    if (socket.data.userId) void socket.join(userRoom(socket.data.userId));

    socket.on('auction:join', async (payload: unknown, acknowledge?: (state: unknown) => void) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return acknowledge?.(null);

      const item = await prisma.item.findUnique({
        where: { id: parsed.data.itemId },
        select: { id: true, status: true, currentPrice: true, currentBidId: true, minBid: true, bidIncrement: true, endDate: true, _count: { select: { bids: true } } },
      });
      if (!item) return acknowledge?.(null);

      await socket.join(auctionRoom(item.id));
      acknowledge?.({
        itemId: item.id,
        status: item.status.toLowerCase(),
        currentPrice: Number(item.currentPrice),
        nextMinimumBid: nextMinimumBid(item),
        endDate: item.endDate,
        bidCount: item._count.bids,
      });
    });

    socket.on('auction:leave', (payload: unknown) => {
      const parsed = joinSchema.safeParse(payload);
      if (parsed.success) void socket.leave(auctionRoom(parsed.data.itemId));
    });
  });

  attachHub(io);
  return io;
};
