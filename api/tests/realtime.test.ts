import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAuctionTick } from '../src/jobs/auctionTimer';
import { prisma } from '../src/lib/prisma';
import { createSocketServer } from '../src/realtime/socket';
import { PASSWORD, app, createItem, createUser, loginAs, resetDb } from './helpers';

let httpServer: HttpServer;
let url: string;
const sockets: Socket[] = [];

beforeEach(async () => {
  await resetDb();
  httpServer = createServer(app);
  createSocketServer(httpServer);
  await new Promise<void>(resolve => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  sockets.splice(0).forEach(socket => socket.close());
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
});

const sessionCookie = async (email: string): Promise<string> => {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
};

const open = async (cookie?: string): Promise<Socket> => {
  const socket = connect(url, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, forceNew: true });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
};

const once = <T>(socket: Socket, event: string): Promise<T> => new Promise(resolve => socket.once(event, resolve));

const join = (socket: Socket, itemId: number) =>
  new Promise<Record<string, unknown> | null>(resolve => socket.emit('auction:join', { itemId }, resolve));

describe('live auctions', () => {
  it('returns the current auction state when a client joins, even without an account', async () => {
    const seller = await createUser();
    const item = await createItem({ sellerId: seller.id, minBid: 50, bidIncrement: 5 });
    const guest = await open();

    const state = await join(guest, item.id);
    expect(state).toMatchObject({ itemId: item.id, status: 'active', currentPrice: 50, nextMinimumBid: 50, bidCount: 0 });
    expect(await join(guest, 999999)).toBeNull();
  });

  it('pushes new bids to everyone watching the auction instantly', async () => {
    const seller = await createUser();
    const alice = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const watcher = await open();
    await join(watcher, item.id);
    const received = once<{ bid: { amount: number; bidderName: string }; nextMinimumBid: number }>(watcher, 'bid:placed');

    await (await loginAs(alice.email)).post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);
    expect(await received).toMatchObject({ bid: { amount: 60, bidderName: alice.username }, nextMinimumBid: 65 });
  });

  it('does not send bids to clients that left the auction', async () => {
    const seller = await createUser();
    const alice = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const watcher = await open();
    await join(watcher, item.id);
    watcher.emit('auction:leave', { itemId: item.id });
    await new Promise(resolve => setTimeout(resolve, 100));

    let heard = false;
    watcher.on('bid:placed', () => {
      heard = true;
    });
    await (await loginAs(alice.email)).post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(heard).toBe(false);
  });

  it('sends a personal notification to the bidder who was outbid and to nobody else', async () => {
    const seller = await createUser();
    const alice = await createUser();
    const bob = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const aliceAgent = await loginAs(alice.email);
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);

    const aliceSocket = await open(await sessionCookie(alice.email));
    const bobSocket = await open(await sessionCookie(bob.email));
    let bobHeard = false;
    bobSocket.on('notification:new', () => {
      bobHeard = true;
    });
    const outbid = once<{ title: string }>(aliceSocket, 'notification:new');

    await (await loginAs(bob.email)).post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);
    expect((await outbid).title).toBe('You have been outbid');
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(bobHeard).toBe(false);
  });
});

describe('auction timer', () => {
  it('closes ended auctions and announces the result to watchers', async () => {
    const seller = await createUser();
    const alice = await createUser();
    const item = await createItem({ sellerId: seller.id, endsInHours: -1 });
    await prisma.bid.create({ data: { itemId: item.id, bidderId: alice.id, amount: 70, isWinning: true } });
    const watcher = await open();
    await join(watcher, item.id);
    const ended = once<{ status: string; winningBid: { amount: number } | null }>(watcher, 'auction:ended');

    expect(await runAuctionTick()).toMatchObject({ closed: 1 });
    expect(await ended).toMatchObject({ status: 'sold', winningBid: { amount: 70 } });
  });

  it('sends ending-soon reminders at the 30, 15, 5 and 1 minute marks only', async () => {
    const seller = await createUser();
    const fiveMinutes = await createItem({ sellerId: seller.id });
    await prisma.item.update({ where: { id: fiveMinutes.id }, data: { endDate: new Date(Date.now() + 5 * 60_000) } });
    const offMark = await createItem({ sellerId: seller.id });
    await prisma.item.update({ where: { id: offMark.id }, data: { endDate: new Date(Date.now() + 20 * 60_000) } });

    const watcher = await open();
    await join(watcher, fiveMinutes.id);
    await join(watcher, offMark.id);
    const reminders: { itemId: number; minutesLeft: number }[] = [];
    watcher.on('auction:ending', payload => reminders.push(payload));

    expect(await runAuctionTick()).toMatchObject({ reminded: 1 });
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(reminders).toEqual([expect.objectContaining({ itemId: fiveMinutes.id, minutesLeft: 5 })]);
  });
});
