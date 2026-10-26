import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

type Agent = Awaited<ReturnType<typeof loginAs>>;

const setup = async () => {
  const [seller, alice, bob] = await Promise.all([createUser(), createUser(), createUser()]);
  const item = await createItem({ sellerId: seller.id, minBid: 50, bidIncrement: 5 });
  const [aliceAgent, bobAgent] = await Promise.all([loginAs(alice.email), loginAs(bob.email)]);
  return { seller, alice, bob, item, aliceAgent, bobAgent };
};

const bid = (agent: Agent, itemId: number, body: { amount: number; maxAmount?: number }) => agent.post(`/api/items/${itemId}/bids`).send(body);
const state = async (itemId: number) => {
  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId }, include: { currentBid: true } });
  return { price: Number(item.currentPrice), leaderId: item.currentBid?.bidderId };
};
const ledger = async (itemId: number) => (await prisma.bid.findMany({ where: { itemId }, orderBy: { id: 'asc' } })).map(entry => [entry.bidderId, Number(entry.amount)]);

describe('proxy bidding', () => {
  it('defends a maximum against a manual bid by one increment', async () => {
    const { item, alice, bob, aliceAgent, bobAgent } = await setup();
    const first = await bid(aliceAgent, item.id, { amount: 50, maxAmount: 100 }).expect(201);
    expect(first.body.data).toMatchObject({ leading: true, currentPrice: 50 });

    const answered = await bid(bobAgent, item.id, { amount: 60 }).expect(201);
    expect(answered.body.data).toMatchObject({ leading: false, currentPrice: 65, nextMinimumBid: 70 });
    expect(await state(item.id)).toEqual({ price: 65, leaderId: alice.id });
    expect(await prisma.notification.count({ where: { userId: bob.id, title: 'You have been outbid' } })).toBe(1);

    const detail = (await aliceAgent.get(`/api/items/${item.id}`).expect(200)).body.data;
    expect(detail.viewer).toMatchObject({ isLeading: true, myMaxBid: 100 });
    expect((await bobAgent.get(`/api/items/${item.id}`).expect(200)).body.data.viewer.myMaxBid).toBeNull();
  });

  it('lets a bid above the other maximum take the lead outright', async () => {
    const { item, bob, aliceAgent, bobAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 50, maxAmount: 100 }).expect(201);
    const taken = await bid(bobAgent, item.id, { amount: 110 }).expect(201);
    expect(taken.body.data).toMatchObject({ leading: true, currentPrice: 110 });
    expect(await state(item.id)).toEqual({ price: 110, leaderId: bob.id });
  });

  it('settles two maximums at one increment above the lower one and records both in the ledger', async () => {
    const { item, alice, bob, aliceAgent, bobAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 50, maxAmount: 100 }).expect(201);
    const res = await bid(bobAgent, item.id, { amount: 60, maxAmount: 150 }).expect(201);
    expect(res.body.data).toMatchObject({ leading: true, currentPrice: 105 });
    expect(await state(item.id)).toEqual({ price: 105, leaderId: bob.id });
    expect(await ledger(item.id)).toEqual([[alice.id, 50], [bob.id, 60], [alice.id, 100], [bob.id, 105]]);
  });

  it('lets the earlier maximum win a tie', async () => {
    const { item, alice, aliceAgent, bobAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 50, maxAmount: 100 }).expect(201);
    await bid(bobAgent, item.id, { amount: 60, maxAmount: 100 }).expect(201);
    expect(await state(item.id)).toEqual({ price: 100, leaderId: alice.id });
  });

  it('raises the leader’s maximum, and refuses a lower one', async () => {
    const { item, alice, bob, aliceAgent, bobAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 50, maxAmount: 80 }).expect(201);
    await aliceAgent.put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 70 }).expect(400);
    await aliceAgent.put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 200 }).expect(200);

    await bid(bobAgent, item.id, { amount: 90 }).expect(201);
    expect(await state(item.id)).toEqual({ price: 95, leaderId: alice.id });
    expect((await aliceAgent.get(`/api/items/${item.id}`).expect(200)).body.data.viewer.myMaxBid).toBe(200);
    expect(await prisma.autoBid.count({ where: { userId: bob.id } })).toBe(0);
    expect(await prisma.autoBid.count({ where: { userId: alice.id } })).toBe(1);
  });

  it('places the minimum bid when a rival sets a maximum without leading', async () => {
    const { item, bob, aliceAgent, bobAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 50 }).expect(201);
    await bobAgent.put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 54 }).expect(400);
    const res = await bobAgent.put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 120 }).expect(200);
    expect(res.body.data).toMatchObject({ leading: true, currentPrice: 55, maxAmount: 120 });
    expect((await state(item.id)).leaderId).toBe(bob.id);
  });

  it('rejects a maximum below the bid, and keeps the usual bidding rules', async () => {
    const { item, seller, aliceAgent } = await setup();
    await bid(aliceAgent, item.id, { amount: 60, maxAmount: 55 }).expect(400);
    await bid(aliceAgent, item.id, { amount: 40 }).expect(400);
    await request(app).put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 90 }).expect(401);
    await (await loginAs(seller.email)).put(`/api/items/${item.id}/max-bid`).send({ maxAmount: 90 }).expect(400);
  });
});
