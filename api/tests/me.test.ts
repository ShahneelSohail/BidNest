import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { closeAuction } from '../src/modules/auctions/auction.service';
import { app, checkout, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

const bidOn = (agent: Awaited<ReturnType<typeof loginAs>>, itemId: number, amount: number) =>
  agent.post(`/api/items/${itemId}/bids`).send({ amount }).expect(201);

const scenario = async () => {
  const seller = await createUser();
  const alice = await createUser();
  const bob = await createUser();
  const [aliceAgent, bobAgent] = await Promise.all([loginAs(alice.email), loginAs(bob.email)]);
  return { seller, alice, bob, aliceAgent, bobAgent };
};

describe('my bids and dashboard', () => {
  it('filters bids into active, leading, won and lost', async () => {
    const { seller, aliceAgent, bobAgent } = await scenario();
    const leading = await createItem({ sellerId: seller.id, title: 'Leading item' });
    const outbid = await createItem({ sellerId: seller.id, title: 'Outbid item' });
    const won = await createItem({ sellerId: seller.id, title: 'Won item' });
    const lost = await createItem({ sellerId: seller.id, title: 'Lost item' });

    await bidOn(aliceAgent, leading.id, 50);
    await bidOn(aliceAgent, outbid.id, 50);
    await bidOn(bobAgent, outbid.id, 60);
    await bidOn(aliceAgent, won.id, 50);
    await bidOn(aliceAgent, lost.id, 50);
    await bidOn(bobAgent, lost.id, 70);
    await closeAuction(won.id);
    await closeAuction(lost.id);

    const titles = async (filter: string) =>
      ((await aliceAgent.get(`/api/me/bids?filter=${filter}`).expect(200)).body.data as { title: string }[]).map(item => item.title).sort();
    expect(await titles('all')).toHaveLength(4);
    expect(await titles('active')).toEqual(['Leading item', 'Outbid item']);
    expect(await titles('leading')).toEqual(['Leading item']);
    expect(await titles('won')).toEqual(['Won item']);
    expect(await titles('lost')).toEqual(['Lost item']);

    const dashboard = await aliceAgent.get('/api/me/dashboard').expect(200);
    expect(dashboard.body.data.stats).toMatchObject({ activeBids: 2, leading: 1, won: 1 });
    const ending = dashboard.body.data.endingSoon as { title: string; myHighestBid: number; isLeading: boolean }[];
    expect(ending.find(item => item.title === 'Leading item')).toMatchObject({ myHighestBid: 50, isLeading: true });
    expect(ending.find(item => item.title === 'Outbid item')).toMatchObject({ myHighestBid: 50, isLeading: false });
  });

  it('requires a signed-in user', async () => {
    await request(app).get('/api/me/bids').expect(401);
    await request(app).get('/api/me/notifications').expect(401);
  });
});

describe('won auctions, payment and ratings', () => {
  const winAuction = async () => {
    const ctx = await scenario();
    const item = await createItem({ sellerId: ctx.seller.id });
    await bidOn(ctx.aliceAgent, item.id, 80);
    await closeAuction(item.id);
    return { ...ctx, item };
  };

  it('lets the winner pay once, and nobody else', async () => {
    const { item, aliceAgent, bobAgent, seller } = await winAuction();
    expect(((await aliceAgent.get('/api/me/won').expect(200)).body.data as unknown[]).length).toBe(1);
    expect(((await bobAgent.get('/api/me/won').expect(200)).body.data as unknown[]).length).toBe(0);

    await checkout(bobAgent, item.id).then(res => expect(res.status).toBe(404));
    const paid = await checkout(aliceAgent, item.id).then(res => {
      expect(res.status).toBe(201);
      return res;
    });
    expect(paid.body.data).toMatchObject({ amount: 165, receiptNo: 'BN-000001' });
    await checkout(aliceAgent, item.id).then(res => expect(res.status).toBe(409));
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'Payment received' } })).toBe(1);
  });

  it('only allows one rating, and only after payment', async () => {
    const { item, aliceAgent, seller } = await winAuction();
    await aliceAgent.post(`/api/me/won/${item.id}/rating`).send({ score: 5 }).expect(400);
    await checkout(aliceAgent, item.id).then(res => expect(res.status).toBe(201));
    await aliceAgent.post(`/api/me/won/${item.id}/rating`).send({ score: 6 }).expect(400);
    await aliceAgent.post(`/api/me/won/${item.id}/rating`).send({ score: 4, comment: 'Smooth deal' }).expect(201);
    await aliceAgent.post(`/api/me/won/${item.id}/rating`).send({ score: 5 }).expect(409);

    const profile = await request(app).get(`/api/users/${seller.id}`).expect(200);
    expect(profile.body.data).toMatchObject({ itemsSold: 1, rating: { average: 4, count: 1 } });
    expect(profile.body.data.reviews[0]).toMatchObject({ score: 4, comment: 'Smooth deal' });
    const detail = await request(app).get(`/api/items/${item.id}`).expect(200);
    expect(detail.body.data.sellerRating).toEqual({ average: 4, count: 1 });
  });
});

describe('watchlist, notifications and messages', () => {
  it('lists the watchlist', async () => {
    const { seller, aliceAgent } = await scenario();
    const item = await createItem({ sellerId: seller.id, title: 'Watched item' });
    await aliceAgent.put(`/api/items/${item.id}/watch`).expect(200);
    const res = await aliceAgent.get('/api/me/watchlist').expect(200);
    expect(res.body.data.map((entry: { title: string }) => entry.title)).toEqual(['Watched item']);
  });

  it('reads, filters and deletes only my own notifications', async () => {
    const { alice, bob, aliceAgent } = await scenario();
    const mine = await prisma.notification.create({ data: { userId: alice.id, title: 'Mine', message: 'For Alice' } });
    const theirs = await prisma.notification.create({ data: { userId: bob.id, title: 'Theirs', message: 'For Bob' } });
    await prisma.notification.create({ data: { userId: alice.id, title: 'Another', message: 'Second', isRead: true } });

    const unread = await aliceAgent.get('/api/me/notifications?unread=true').expect(200);
    expect(unread.body.data).toHaveLength(1);
    expect(unread.body.meta.unread).toBe(1);

    await aliceAgent.patch(`/api/me/notifications/${theirs.id}/read`).expect(404);
    await aliceAgent.patch(`/api/me/notifications/${mine.id}/read`).expect(204);
    expect((await aliceAgent.get('/api/me/notifications').expect(200)).body.meta.unread).toBe(0);

    await aliceAgent.delete(`/api/me/notifications/${theirs.id}`).expect(204);
    expect(await prisma.notification.count({ where: { id: theirs.id } })).toBe(1);
    await aliceAgent.post('/api/me/notifications/read-all').expect(204);
  });

  it('accepts enquiries from visitors without an account and validates them', async () => {
    await request(app).post('/api/contact/public').send({ name: 'Guest', email: 'guest@example.com', message: 'short' }).expect(400);
    await request(app).post('/api/contact/public').send({ name: '', email: 'guest@example.com', message: 'A long enough message' }).expect(400);
    await request(app).post('/api/contact/public').send({ name: 'Guest', email: 'nope', message: 'A long enough message' }).expect(400);
    await request(app).post('/api/contact/public').send({ name: 'Guest', email: 'Guest@Example.com', message: 'How do I list an item?' }).expect(201);

    const stored = await prisma.contactMessage.findFirstOrThrow();
    expect(stored).toMatchObject({ userId: null, name: 'Guest', email: 'guest@example.com', subject: 'Website enquiry', status: 'NEW' });
  });

  it('sends contact messages and shows them with any reply', async () => {
    const { alice, aliceAgent } = await scenario();
    await request(app).post('/api/contact').send({ subject: 'Hello', message: 'A message long enough' }).expect(401);
    await aliceAgent.post('/api/contact').send({ subject: 'Hello', message: 'short' }).expect(400);
    await aliceAgent.post('/api/contact').send({ subject: 'Payment question', message: 'How does payment work here?', newsletter: true }).expect(201);

    const stored = await prisma.contactMessage.findFirstOrThrow({ where: { userId: alice.id } });
    expect(stored).toMatchObject({ status: 'NEW', name: alice.fullName, email: alice.email, newsletterSubscription: true });
    await prisma.contactMessage.update({ where: { id: stored.id }, data: { status: 'REPLIED', adminReply: 'Pay from your dashboard.' } });

    const mine = await aliceAgent.get('/api/me/messages').expect(200);
    expect(mine.body.data[0]).toMatchObject({ subject: 'Payment question', status: 'replied', adminReply: 'Pay from your dashboard.' });
  });
});
