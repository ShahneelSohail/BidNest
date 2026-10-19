import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { closeAuction, closeEndedAuctions } from '../src/modules/auctions/auction.service';
import { app, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

const setup = async () => {
  const seller = await createUser();
  const alice = await createUser();
  const bob = await createUser();
  const item = await createItem({ sellerId: seller.id, minBid: 50, bidIncrement: 5 });
  return { seller, alice, bob, item, aliceAgent: await loginAs(alice.email), bobAgent: await loginAs(bob.email) };
};

describe('placing bids', () => {
  it('requires a signed-in user', async () => {
    const { item } = await setup();
    await request(app).post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(401);
  });

  it('accepts the minimum bid first, then requires current price plus the increment', async () => {
    const { item, aliceAgent, bobAgent } = await setup();

    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 49 }).expect(400);
    const first = await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    expect(first.body.data.nextMinimumBid).toBe(55);

    const tooLow = await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 54 }).expect(400);
    expect(tooLow.body.error.message).toMatch(/at least \$55\.00/);
    await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 55 }).expect(201);
  });

  it('keeps exactly one winning bid and updates the item price', async () => {
    const { item, aliceAgent, bobAgent } = await setup();
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);

    const winning = await prisma.bid.findMany({ where: { itemId: item.id, isWinning: true } });
    expect(winning).toHaveLength(1);
    expect(Number(winning[0]?.amount)).toBe(60);
    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(Number(updated.currentPrice)).toBe(60);
    expect(updated.currentBidId).toBe(winning[0]?.id);
  });

  it('rejects a bidder who already has a higher bid', async () => {
    const { item, aliceAgent, bobAgent } = await setup();
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 55 }).expect(201);
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);

    await prisma.item.update({ where: { id: item.id }, data: { bidIncrement: 0.01 } });
    const res = await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60.01 }).expect(201);
    expect(res.body.data.bid.amount).toBe(60.01);
  });

  it('stops sellers from bidding on their own item', async () => {
    const { seller, item } = await setup();
    const sellerAgent = await loginAs(seller.email);
    const res = await sellerAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(400);
    expect(res.body.error.message).toMatch(/own item/);
  });

  it('rejects bids on ended, pending and unknown auctions', async () => {
    const { seller, aliceAgent } = await setup();
    const ended = await createItem({ sellerId: seller.id, endsInHours: -1 });
    const pending = await createItem({ sellerId: seller.id, status: 'PENDING' });

    await aliceAgent.post(`/api/items/${ended.id}/bids`).send({ amount: 60 }).expect(400);
    await aliceAgent.post(`/api/items/${pending.id}/bids`).send({ amount: 60 }).expect(400);
    await aliceAgent.post('/api/items/999999/bids').send({ amount: 60 }).expect(404);
  });

  it('notifies the previous leader and the seller', async () => {
    const { seller, alice, item, aliceAgent, bobAgent } = await setup();
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);

    const outbid = await prisma.notification.findMany({ where: { userId: alice.id, title: 'You have been outbid' } });
    expect(outbid).toHaveLength(1);
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'New bid on your item' } })).toBe(2);
  });

  it('lets only one of several simultaneous identical bids win', async () => {
    const { item } = await setup();
    const bidders = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
    const agents = await Promise.all(bidders.map(user => loginAs(user.email)));

    const results = await Promise.all(agents.map(agent => agent.post(`/api/items/${item.id}/bids`).send({ amount: 50 })));
    expect(results.filter(res => res.status === 201)).toHaveLength(1);
    expect(results.filter(res => res.status === 400)).toHaveLength(3);
    expect(await prisma.bid.count({ where: { itemId: item.id, isWinning: true } })).toBe(1);
  });
});

describe('closing auctions', () => {
  it('sells to the highest bidder and notifies both sides', async () => {
    const { seller, alice, bob, item, aliceAgent, bobAgent } = await setup();
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    await bobAgent.post(`/api/items/${item.id}/bids`).send({ amount: 60 }).expect(201);

    await closeAuction(item.id);
    const sold = await prisma.item.findUniqueOrThrow({ where: { id: item.id }, include: { currentBid: true } });
    expect(sold.status).toBe('SOLD');
    expect(sold.currentBid?.bidderId).toBe(bob.id);
    expect(Number(sold.currentPrice)).toBe(60);
    expect(await prisma.notification.count({ where: { userId: bob.id, title: 'You won the auction' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'Your item sold' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: alice.id, title: 'You won the auction' } })).toBe(0);
  });

  it('breaks ties in favour of the earlier bid', async () => {
    const { alice, item } = await setup();
    const bob = await prisma.user.findFirstOrThrow({ where: { email: { not: alice.email } }, orderBy: { id: 'desc' } });
    const earlier = new Date(Date.now() - 60_000);
    await prisma.bid.create({ data: { itemId: item.id, bidderId: bob.id, amount: 70, bidTime: new Date() } });
    await prisma.bid.create({ data: { itemId: item.id, bidderId: alice.id, amount: 70, bidTime: earlier } });

    await closeAuction(item.id);
    const sold = await prisma.item.findUniqueOrThrow({ where: { id: item.id }, include: { currentBid: true } });
    expect(sold.currentBid?.bidderId).toBe(alice.id);
  });

  it('expires auctions that ended without bids and ignores already closed ones', async () => {
    const { seller } = await setup();
    const empty = await createItem({ sellerId: seller.id, endsInHours: -2 });
    const closed = await createItem({ sellerId: seller.id, endsInHours: -2, status: 'SOLD' });

    expect(await closeEndedAuctions()).toBe(1);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: empty.id } })).status).toBe('EXPIRED');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: closed.id } })).status).toBe('SOLD');
    expect(await closeAuction(empty.id)).toBeNull();
  });
});
