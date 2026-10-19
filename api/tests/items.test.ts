import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createCategory, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

describe('browsing items', () => {
  it('only lists live auctions by default and hides pending and rejected items', async () => {
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'Live item one' });
    await createItem({ sellerId: seller.id, title: 'Awaiting approval', status: 'PENDING' });
    await createItem({ sellerId: seller.id, title: 'Rejected item', status: 'REJECTED' });
    await createItem({ sellerId: seller.id, title: 'Already ended', endsInHours: -3 });

    const res = await request(app).get('/api/items').expect(200);
    expect(res.body.data.map((item: { title: string }) => item.title)).toEqual(['Live item one']);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });
  });

  it('searches titles, descriptions and category names', async () => {
    const seller = await createUser();
    const watches = await createCategory('Watches');
    await createItem({ sellerId: seller.id, title: 'Rolex Submariner', categoryId: watches.id });
    await createItem({ sellerId: seller.id, title: 'Old typewriter' });

    const byTitle = await request(app).get('/api/items?q=rolex').expect(200);
    expect(byTitle.body.data).toHaveLength(1);
    const byCategory = await request(app).get('/api/items?q=watch').expect(200);
    expect(byCategory.body.data[0].title).toBe('Rolex Submariner');
    expect((await request(app).get('/api/items?q=nothing-matches').expect(200)).body.data).toHaveLength(0);
  });

  it('filters by category including subcategories, price range and bids', async () => {
    const seller = await createUser();
    const parent = await createCategory('Electronics');
    const child = await prisma.category.create({ data: { name: 'Laptops', parentId: parent.id } });
    await createItem({ sellerId: seller.id, title: 'Cheap laptop', categoryId: child.id, minBid: 100 });
    await createItem({ sellerId: seller.id, title: 'Pricey laptop', categoryId: child.id, minBid: 900 });
    await createItem({ sellerId: seller.id, title: 'Unrelated item' });

    const inParent = await request(app).get(`/api/items?categoryId=${parent.id}`).expect(200);
    expect(inParent.body.data).toHaveLength(2);
    const ranged = await request(app).get(`/api/items?categoryId=${parent.id}&minPrice=500&maxPrice=1000`).expect(200);
    expect(ranged.body.data.map((item: { title: string }) => item.title)).toEqual(['Pricey laptop']);
    expect((await request(app).get('/api/items?hasBids=true').expect(200)).body.data).toHaveLength(0);
  });

  it('sorts by price and ending time and paginates', async () => {
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'B', minBid: 20, endsInHours: 5 });
    await createItem({ sellerId: seller.id, title: 'A', minBid: 90, endsInHours: 1 });
    await createItem({ sellerId: seller.id, title: 'C', minBid: 50, endsInHours: 9 });

    const titles = async (query: string) =>
      (await request(app).get(`/api/items?${query}`).expect(200)).body.data.map((item: { title: string }) => item.title);
    expect(await titles('sort=ending')).toEqual(['A', 'B', 'C']);
    expect(await titles('sort=price_asc')).toEqual(['B', 'C', 'A']);
    expect(await titles('sort=price_desc')).toEqual(['A', 'C', 'B']);

    const page = await request(app).get('/api/items?sort=price_asc&pageSize=2&page=2').expect(200);
    expect(page.body.data.map((item: { title: string }) => item.title)).toEqual(['A']);
    expect(page.body.meta).toMatchObject({ total: 3, totalPages: 2 });
  });

  it('supports the ending-soon and sold filters and rejects bad query values', async () => {
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'Soon', endsInHours: 2 });
    await createItem({ sellerId: seller.id, title: 'Later', endsInHours: 100 });
    await createItem({ sellerId: seller.id, title: 'Gone', status: 'SOLD', endsInHours: -5 });

    const soon = await request(app).get('/api/items?status=ending').expect(200);
    expect(soon.body.data.map((item: { title: string }) => item.title)).toEqual(['Soon']);
    const sold = await request(app).get('/api/items?status=sold').expect(200);
    expect(sold.body.data.map((item: { title: string }) => item.title)).toEqual(['Gone']);
    await request(app).get('/api/items?sort=nonsense').expect(400);
    await request(app).get('/api/items?pageSize=500').expect(400);
  });

  it('suggests active titles', async () => {
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'Vintage camera' });
    await createItem({ sellerId: seller.id, title: 'Vintage clock', status: 'PENDING' });
    const res = await request(app).get('/api/items/suggestions?q=vint').expect(200);
    expect(res.body.data.map((item: { title: string }) => item.title)).toEqual(['Vintage camera']);
  });
});

describe('item detail', () => {
  it('shows live items to anyone and pending items only to the seller and admins', async () => {
    const seller = await createUser();
    const stranger = await createUser();
    const admin = await createUser({ role: 'ADMIN' });
    const pending = await createItem({ sellerId: seller.id, status: 'PENDING' });
    const live = await createItem({ sellerId: seller.id });

    await request(app).get(`/api/items/${live.id}`).expect(200);
    await request(app).get(`/api/items/${pending.id}`).expect(404);
    await (await loginAs(stranger.email)).get(`/api/items/${pending.id}`).expect(404);
    await (await loginAs(seller.email)).get(`/api/items/${pending.id}`).expect(200);
    await (await loginAs(admin.email)).get(`/api/items/${pending.id}`).expect(200);
    await request(app).get('/api/items/999999').expect(404);
  });

  it('reports pricing, the viewer relationship and recent bids', async () => {
    const seller = await createUser();
    const bidder = await createUser();
    const item = await createItem({ sellerId: seller.id, minBid: 50, bidIncrement: 5 });
    const agent = await loginAs(bidder.email);

    const before = await agent.get(`/api/items/${item.id}`).expect(200);
    expect(before.body.data).toMatchObject({ nextMinimumBid: 50, hasBids: false, viewer: { isSeller: false, isLeading: false } });

    await agent.post(`/api/items/${item.id}/bids`).send({ amount: 50 }).expect(201);
    const after = await agent.get(`/api/items/${item.id}`).expect(200);
    expect(after.body.data).toMatchObject({ nextMinimumBid: 55, currentPrice: 50, hasBids: true, bidCount: 1 });
    expect(after.body.data.viewer).toMatchObject({ isLeading: true, myHighestBid: 50 });
    expect(after.body.data.recentBids[0]).toMatchObject({ bidderName: bidder.username, amount: 50 });
  });
});

describe('watchlist', () => {
  it('adds, removes and refuses to watch your own item', async () => {
    const seller = await createUser();
    const watcher = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const agent = await loginAs(watcher.email);

    await request(app).put(`/api/items/${item.id}/watch`).expect(401);
    await agent.put(`/api/items/${item.id}/watch`).expect(200);
    await agent.put(`/api/items/${item.id}/watch`).expect(200);
    expect(await prisma.watchlist.count({ where: { userId: watcher.id } })).toBe(1);
    await agent.delete(`/api/items/${item.id}/watch`).expect(200);
    expect(await prisma.watchlist.count({ where: { userId: watcher.id } })).toBe(0);
    await (await loginAs(seller.email)).put(`/api/items/${item.id}/watch`).expect(409);
  });
});

describe('categories', () => {
  it('returns active categories as a tree with live item counts', async () => {
    const seller = await createUser();
    const parent = await createCategory('Furniture');
    await prisma.category.create({ data: { name: 'Chairs', parentId: parent.id } });
    await prisma.category.create({ data: { name: 'Hidden', isActive: false } });
    await createItem({ sellerId: seller.id, categoryId: parent.id });

    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ name: 'Furniture', activeItems: 1 });
    expect(res.body.data[0].children.map((child: { name: string }) => child.name)).toEqual(['Chairs']);
  });
});
