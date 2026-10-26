import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/upload';
import { closeAuction } from '../src/modules/auctions/auction.service';
import { app, createCategory, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const createdFiles = new Set<string>();

afterAll(() => {
  for (const file of createdFiles) fs.rmSync(path.join(UPLOAD_DIR, file), { force: true });
});

const listing = (overrides: Record<string, string> = {}) => ({ title: 'Brass desk lamp', description: 'Polished and fully working.', minBid: '40', durationDays: '7', ...overrides });

const createListing = async (agent: Awaited<ReturnType<typeof loginAs>>, fields: Record<string, string>, images = 1) => {
  let req = agent.post('/api/seller/items');
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  for (let index = 0; index < images; index++) req = req.attach('images', PNG, { filename: `lamp-${index}.png`, contentType: 'image/png' });
  const res = await req;
  for (const image of res.body.data?.images ?? []) createdFiles.add(path.basename(image.url));
  return res;
};

describe('creating listings', () => {
  it('creates a pending listing with the original increment and duration rules', async () => {
    const seller = await createUser();
    const agent = await loginAs(seller.email);
    const res = await createListing(agent, listing(), 2);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', minBid: 40, currentPrice: 40, bidIncrement: 2 });
    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images.filter((image: { isPrimary: boolean }) => image.isPrimary)).toHaveLength(1);
    const days = (new Date(res.body.data.endDate).getTime() - new Date(res.body.data.startDate).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it('uses a minimum increment of 1 for small bids', async () => {
    const agent = await loginAs((await createUser()).email);
    const res = await createListing(agent, listing({ minBid: '10' }));
    expect(res.body.data.bidIncrement).toBe(1);
  });

  it('enforces the name, price and duration rules', async () => {
    const agent = await loginAs((await createUser()).email);
    expect((await createListing(agent, listing({ title: 'Lamp' }))).status).toBe(400);
    expect((await createListing(agent, listing({ minBid: '0' }))).status).toBe(400);
    expect((await createListing(agent, listing({ durationDays: '31' }))).status).toBe(400);
    expect((await createListing(agent, listing({ durationDays: '0' }))).status).toBe(400);
    expect((await createListing(agent, listing({ categoryId: '9999' }))).status).toBe(400);
  });

  it('rejects non-image uploads and cleans up nothing it did not save', async () => {
    const agent = await loginAs((await createUser()).email);
    const res = await agent
      .post('/api/seller/items')
      .field('title', 'Brass desk lamp')
      .field('minBid', '40')
      .field('durationDays', '7')
      .attach('images', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(await prisma.item.count()).toBe(0);
  });

  it('requires a signed-in user', async () => {
    await request(app).get('/api/seller/items').expect(401);
  });
});

describe('managing listings', () => {
  it('lists only my items and filters by status', async () => {
    const me = await createUser();
    const other = await createUser();
    await createItem({ sellerId: me.id, title: 'Mine pending', status: 'PENDING' });
    await createItem({ sellerId: me.id, title: 'Mine live' });
    await createItem({ sellerId: other.id, title: 'Not mine' });
    const agent = await loginAs(me.email);

    const all = await agent.get('/api/seller/items').expect(200);
    expect(all.body.data).toHaveLength(2);
    const pending = await agent.get('/api/seller/items?status=pending').expect(200);
    expect(pending.body.data.map((item: { title: string }) => item.title)).toEqual(['Mine pending']);
    expect(pending.body.data[0].viewCount).toBe(0);
  });

  it('lets sellers edit only pending items they own', async () => {
    const me = await createUser();
    const other = await createUser();
    const category = await createCategory();
    const pending = await createItem({ sellerId: me.id, status: 'PENDING' });
    const live = await createItem({ sellerId: me.id });
    const theirs = await createItem({ sellerId: other.id, status: 'PENDING' });
    const agent = await loginAs(me.email);

    const edit = (id: number, fields: Record<string, string>) => {
      let req = agent.patch(`/api/seller/items/${id}`);
      for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
      return req;
    };
    const fields = { title: 'Edited item title', description: 'New description', minBid: '120', categoryId: String(category.id) };

    const ok = await edit(pending.id, fields).expect(200);
    expect(ok.body.data).toMatchObject({ title: 'Edited item title', minBid: 120, currentPrice: 120, bidIncrement: 6 });
    expect((await edit(live.id, fields)).status).toBe(400);
    expect((await edit(theirs.id, fields)).status).toBe(403);
  });

  it('deletes items without bids but protects items that received bids', async () => {
    const me = await createUser();
    const bidder = await createUser();
    const clean = await createItem({ sellerId: me.id, status: 'PENDING' });
    const bidOn = await createItem({ sellerId: me.id });
    await prisma.bid.create({ data: { itemId: bidOn.id, bidderId: bidder.id, amount: 60, isWinning: true } });
    const agent = await loginAs(me.email);

    await agent.delete(`/api/seller/items/${clean.id}`).expect(204);
    expect(await prisma.item.count({ where: { id: clean.id } })).toBe(0);
    const blocked = await agent.delete(`/api/seller/items/${bidOn.id}`).expect(400);
    expect(blocked.body.error.message).toMatch(/received bids/);
    await (await loginAs(bidder.email)).delete(`/api/seller/items/${clean.id}`).expect(404);
  });

  it('extends live and expired auctions and reactivates expired ones', async () => {
    const me = await createUser();
    const live = await createItem({ sellerId: me.id, endsInHours: 2 });
    const expired = await createItem({ sellerId: me.id, status: 'EXPIRED', endsInHours: -5 });
    const sold = await createItem({ sellerId: me.id, status: 'SOLD', endsInHours: -5 });
    const agent = await loginAs(me.email);

    const extended = await agent.post(`/api/seller/items/${live.id}/extend`).send({ hours: 24 }).expect(200);
    const gainedHours = (new Date(extended.body.data.endDate).getTime() - live.endDate.getTime()) / 3_600_000;
    expect(Math.round(gainedHours)).toBe(24);

    const revived = await agent.post(`/api/seller/items/${expired.id}/extend`).send({ hours: 12 }).expect(200);
    expect(revived.body.data.status).toBe('active');
    expect(new Date(revived.body.data.endDate).getTime()).toBeGreaterThan(Date.now());
    await agent.post(`/api/seller/items/${sold.id}/extend`).send({ hours: 12 }).expect(400);
  });

  it('ends an auction early and settles it', async () => {
    const me = await createUser();
    const bidder = await createUser();
    const item = await createItem({ sellerId: me.id });
    await prisma.bid.create({ data: { itemId: item.id, bidderId: bidder.id, amount: 80, isWinning: true } });
    const agent = await loginAs(me.email);

    const res = await agent.post(`/api/seller/items/${item.id}/expire`).expect(200);
    expect(res.body.data.status).toBe('sold');
    expect(await closeAuction(item.id)).toBeNull();
    await agent.post(`/api/seller/items/${item.id}/expire`).expect(400);
  });
});

describe('seller dashboard and analytics', () => {
  it('summarises listings, earnings and conversion', async () => {
    const me = await createUser();
    const buyer = await createUser();
    await createItem({ sellerId: me.id, status: 'PENDING' });
    const live = await createItem({ sellerId: me.id });
    await prisma.item.update({ where: { id: live.id }, data: { viewCount: 7 } });
    const soldA = await createItem({ sellerId: me.id, status: 'SOLD', endsInHours: -24, minBid: 100 });
    const soldB = await createItem({ sellerId: me.id, status: 'SOLD', endsInHours: -48, minBid: 300 });
    await prisma.item.update({ where: { id: soldA.id }, data: { currentPrice: 150 } });
    await prisma.item.update({ where: { id: soldB.id }, data: { currentPrice: 350 } });
    await prisma.bid.create({ data: { itemId: soldA.id, bidderId: buyer.id, amount: 150, isWinning: true } });
    const agent = await loginAs(me.email);

    const dash = await agent.get('/api/seller/dashboard').expect(200);
    expect(dash.body.data.stats).toMatchObject({ activeListings: 1, pendingListings: 1, soldItems: 2, totalEarnings: 500, averageSellingPrice: 250 });
    expect(dash.body.data.recentBids).toHaveLength(1);

    const analytics = await agent.get('/api/seller/analytics').expect(200);
    expect(analytics.body.data).toMatchObject({ totalListings: 4, soldItems: 2, totalEarnings: 500, conversionRate: 50, totalViews: 7, rejectedListings: 0, expiredListings: 0 });
    const dailySold = analytics.body.data.dailyEarnings.reduce((sum: number, day: { itemsSold: number }) => sum + day.itemsSold, 0);
    expect(dailySold).toBe(2);
    expect(analytics.body.data.monthlyEarnings).toHaveLength(12);
    const monthTotal = analytics.body.data.monthlyEarnings.reduce((sum: number, month: { earnings: number }) => sum + month.earnings, 0);
    expect(monthTotal).toBe(500);
  });
});

describe('draft listings', () => {
  it('saves a draft without photos, keeps it private and lets the seller edit, submit and delete it', async () => {
    const seller = await createUser();
    const agent = await loginAs(seller.email);
    const admin = await loginAs((await createUser({ role: 'ADMIN' })).email);

    const created = await createListing(agent, listing({ draft: 'true' }), 0);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('draft');
    const id = created.body.data.id as number;

    await request(app).get(`/api/items/${id}`).expect(404);
    expect(((await request(app).get('/api/items?status=all').expect(200)).body.data as unknown[]).length).toBe(0);
    expect(((await admin.get('/api/admin/approvals').expect(200)).body.data as unknown[]).length).toBe(0);
    expect(((await admin.get('/api/admin/items').expect(200)).body.data as unknown[]).length).toBe(0);
    expect(((await agent.get('/api/seller/items?status=draft').expect(200)).body.data as unknown[]).length).toBe(1);
    expect((await agent.get('/api/seller/dashboard').expect(200)).body.data.stats.draftListings).toBe(1);

    await agent.patch(`/api/seller/items/${id}`).field('title', 'Brass desk lamp, 1930s').field('minBid', '55').expect(200);
    await agent.post(`/api/seller/items/${id}/submit`).expect(400);

    await agent.patch(`/api/seller/items/${id}`).field('title', 'Brass desk lamp, 1930s').field('minBid', '55').attach('images', PNG, { filename: 'lamp.png', contentType: 'image/png' }).expect(200);
    const submitted = await agent.post(`/api/seller/items/${id}/submit`).expect(200);
    expect(submitted.body.data.status).toBe('pending');
    expect(((await admin.get('/api/admin/approvals').expect(200)).body.data as unknown[]).length).toBe(1);
    await agent.post(`/api/seller/items/${id}/submit`).expect(400);
  });

  it('does not let another seller touch or submit a draft, and deletes unsubmitted drafts', async () => {
    const [owner, other] = await Promise.all([createUser(), createUser()]);
    const ownerAgent = await loginAs(owner.email);
    const id = (await createListing(ownerAgent, listing({ draft: 'true' }), 0)).body.data.id as number;

    const otherAgent = await loginAs(other.email);
    await otherAgent.post(`/api/seller/items/${id}/submit`).expect(403);
    await otherAgent.patch(`/api/seller/items/${id}`).field('title', 'Hijacked lamp title').field('minBid', '10').expect(403);
    await ownerAgent.delete(`/api/seller/items/${id}`).expect(204);
  });
});
