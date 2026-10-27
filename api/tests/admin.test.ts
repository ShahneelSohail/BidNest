import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createCategory, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(resetDb);

const adminAgent = async () => loginAs((await createUser({ role: 'ADMIN' })).email);

describe('admin access control', () => {
  it('locks out anonymous visitors and ordinary users from every admin area', async () => {
    const user = await createUser();
    const agent = await loginAs(user.email);
    for (const path of ['/dashboard', '/users', '/categories', '/items', '/approvals', '/bids', '/messages']) {
      await request(app).get(`/api/admin${path}`).expect(401);
      await agent.get(`/api/admin${path}`).expect(403);
    }
  });
});

describe('admin dashboard', () => {
  it('reports platform stats and recent activity', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const bidder = await createUser();
    const live = await createItem({ sellerId: seller.id });
    await createItem({ sellerId: seller.id, status: 'PENDING' });
    await prisma.bid.create({ data: { itemId: live.id, bidderId: bidder.id, amount: 55, isWinning: true } });
    await prisma.contactMessage.create({ data: { userId: bidder.id, name: 'B', email: 'b@example.com', subject: 'Hi', message: 'A message long enough' } });

    const res = await admin.get('/api/admin/dashboard').expect(200);
    expect(res.body.data.stats).toMatchObject({ totalUsers: 3, liveAuctions: 1, pendingApprovals: 1, totalBids: 1, newMessages: 1 });
    expect(res.body.data.activity.length).toBeGreaterThan(0);
    expect(res.body.data.bidsPerHour).toHaveLength(24);
    expect(res.body.data.bidsPerHour[23]).toBe(1);
  });
});

describe('admin users', () => {
  it('searches users and blocks and unblocks them, never admins', async () => {
    const admin = await adminAgent();
    const target = await createUser({ username: 'findme' });
    await createUser({ username: 'someone' });

    const found = await admin.get('/api/admin/users?q=findme').expect(200);
    expect(found.body.data).toHaveLength(1);

    expect((await admin.patch(`/api/admin/users/${target.id}/block`).expect(200)).body.data.isBlocked).toBe(true);
    await request(app).post('/api/auth/login').send({ email: target.email, password: 'Password123!' }).expect(403);
    expect((await admin.patch(`/api/admin/users/${target.id}/block`).expect(200)).body.data.isBlocked).toBe(false);

    const otherAdmin = await createUser({ role: 'ADMIN' });
    await admin.patch(`/api/admin/users/${otherAdmin.id}/block`).expect(403);
    await admin.delete(`/api/admin/users/${otherAdmin.id}`).expect(403);
  });

  it('only deletes users without listings or bids', async () => {
    const admin = await adminAgent();
    const clean = await createUser();
    const seller = await createUser();
    await createItem({ sellerId: seller.id });

    await admin.delete(`/api/admin/users/${seller.id}`).expect(409);
    await admin.delete(`/api/admin/users/${clean.id}`).expect(204);
    expect(await prisma.user.count({ where: { id: clean.id } })).toBe(0);
    await admin.delete('/api/admin/users/999999').expect(404);
  });

  it('shows a user profile with activity counts', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    await createItem({ sellerId: seller.id });
    const res = await admin.get(`/api/admin/users/${seller.id}`).expect(200);
    expect(res.body.data.counts.items).toBe(1);
  });
});

describe('admin categories', () => {
  it('creates, nests, renames and toggles categories', async () => {
    const admin = await adminAgent();
    const parent = (await admin.post('/api/admin/categories').send({ name: 'Furniture' }).expect(201)).body.data;
    const child = (await admin.post('/api/admin/categories').send({ name: 'Chairs', parentId: parent.id }).expect(201)).body.data;

    await admin.post('/api/admin/categories').send({ name: 'Too deep', parentId: child.id }).expect(400);
    await admin.patch(`/api/admin/categories/${parent.id}`).send({ name: 'Furniture', parentId: parent.id }).expect(400);
    await admin.patch(`/api/admin/categories/${parent.id}`).send({ name: 'Home furniture', parentId: child.id }).expect(400);
    await admin.post('/api/admin/categories').send({ name: '' }).expect(400);

    const renamed = await admin.patch(`/api/admin/categories/${child.id}`).send({ name: 'Armchairs', parentId: parent.id }).expect(200);
    expect(renamed.body.data.name).toBe('Armchairs');
    expect((await admin.patch(`/api/admin/categories/${child.id}/toggle`).expect(200)).body.data.isActive).toBe(false);

    const hidden = await admin.get('/api/admin/categories').expect(200);
    expect(hidden.body.data.map((category: { name: string }) => category.name)).toEqual(['Furniture']);
    expect((await admin.get('/api/admin/categories?showInactive=true').expect(200)).body.data).toHaveLength(2);
  });

  it('refuses to delete categories that have items or subcategories', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const withItems = await createCategory('Has items');
    const withChild = await createCategory('Has child');
    await prisma.category.create({ data: { name: 'Child', parentId: withChild.id } });
    const empty = await createCategory('Empty');
    await createItem({ sellerId: seller.id, categoryId: withItems.id });

    await admin.delete(`/api/admin/categories/${withItems.id}`).expect(409);
    await admin.delete(`/api/admin/categories/${withChild.id}`).expect(409);
    await admin.delete(`/api/admin/categories/${empty.id}`).expect(204);
  });

  it('merges one category into another', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const source = await createCategory('Old name');
    const target = await createCategory('New name');
    const child = await prisma.category.create({ data: { name: 'Sub', parentId: source.id } });
    const item = await createItem({ sellerId: seller.id, categoryId: source.id });

    await admin.post('/api/admin/categories/merge').send({ sourceId: source.id, targetId: source.id }).expect(400);
    const res = await admin.post('/api/admin/categories/merge').send({ sourceId: source.id, targetId: target.id, deleteSource: true }).expect(200);
    expect(res.body.data).toMatchObject({ movedItems: 1, sourceDeleted: true });
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).categoryId).toBe(target.id);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: child.id } })).parentId).toBe(target.id);
    expect(await prisma.category.count({ where: { id: source.id } })).toBe(0);
  });
});

describe('admin approvals', () => {
  it('approves a pending item, restarts its clock and tells the seller', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const item = await prisma.item.create({
      data: {
        sellerId: seller.id,
        title: 'Waiting for review',
        minBid: 40,
        currentPrice: 40,
        bidIncrement: 2,
        status: 'PENDING',
        startDate: new Date(Date.now() - 3 * 86_400_000),
        endDate: new Date(Date.now() + 4 * 86_400_000),
      },
    });

    const res = await admin.post(`/api/admin/approvals/${item.id}/approve`).send({ adminNotes: 'Looks good' }).expect(200);
    expect(res.body.data.status).toBe('active');
    const days = (new Date(res.body.data.endDate).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'Your listing was approved' } })).toBe(1);
    await admin.post(`/api/admin/approvals/${item.id}/approve`).send({}).expect(400);
  });

  it('rejects with a mandatory reason and shows it to the seller', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const item = await createItem({ sellerId: seller.id, status: 'PENDING' });

    await admin.post(`/api/admin/approvals/${item.id}/reject`).send({}).expect(400);
    await admin.post(`/api/admin/approvals/${item.id}/reject`).send({ rejectionReason: 'Photos are missing' }).expect(200);

    const sellerAgent = await loginAs(seller.email);
    const detail = await sellerAgent.get(`/api/items/${item.id}`).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Photos are missing' });
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'Your listing was not approved' } })).toBe(1);
  });

  it('lists the approval queue oldest first', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'First', status: 'PENDING' });
    await createItem({ sellerId: seller.id, title: 'Second', status: 'PENDING' });
    await createItem({ sellerId: seller.id, title: 'Live' });
    const res = await admin.get('/api/admin/approvals').expect(200);
    expect(res.body.data.map((item: { title: string }) => item.title)).toEqual(['First', 'Second']);
  });
});

describe('admin items and bids', () => {
  it('filters items, toggles featured, changes status and extends auctions', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const item = await createItem({ sellerId: seller.id, title: 'Searchable lamp', endsInHours: 2 });
    await createItem({ sellerId: seller.id, title: 'Other thing', status: 'SOLD' });

    expect((await admin.get('/api/admin/items?q=lamp').expect(200)).body.data).toHaveLength(1);
    expect((await admin.get('/api/admin/items?status=SOLD').expect(200)).body.data).toHaveLength(1);
    expect((await admin.patch(`/api/admin/items/${item.id}/featured`).expect(200)).body.data.featured).toBe(true);
    const listed = await request(app).get('/api/items').expect(200);
    expect(listed.body.data[0].featured).toBe(true);

    const extended = await admin.post(`/api/admin/items/${item.id}/extend`).send({ days: 2 }).expect(200);
    const gained = (new Date(extended.body.data.endDate).getTime() - item.endDate.getTime()) / 3_600_000;
    expect(Math.round(gained)).toBe(48);
    expect((await admin.patch(`/api/admin/items/${item.id}/status`).send({ status: 'EXPIRED' }).expect(200)).body.data.status).toBe('expired');
    await admin.patch(`/api/admin/items/${item.id}/status`).send({ status: 'NONSENSE' }).expect(400);
  });

  it('deletes an item together with its bids', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const bidder = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const bid = await prisma.bid.create({ data: { itemId: item.id, bidderId: bidder.id, amount: 60, isWinning: true } });
    await prisma.item.update({ where: { id: item.id }, data: { currentBidId: bid.id, currentPrice: 60 } });

    await admin.delete(`/api/admin/items/${item.id}`).expect(204);
    expect(await prisma.item.count({ where: { id: item.id } })).toBe(0);
    expect(await prisma.bid.count({ where: { itemId: item.id } })).toBe(0);
  });

  it('manages item images', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const item = await createItem({ sellerId: seller.id });
    const first = await prisma.itemImage.create({ data: { itemId: item.id, url: '/uploads/a.png', isPrimary: true } });
    const second = await prisma.itemImage.create({ data: { itemId: item.id, url: '/uploads/b.png', isPrimary: false } });

    await admin.patch(`/api/admin/items/${item.id}/images/${second.id}/primary`).expect(204);
    expect((await prisma.itemImage.findUniqueOrThrow({ where: { id: first.id } })).isPrimary).toBe(false);
    await admin.delete(`/api/admin/items/${item.id}/images/${second.id}`).expect(204);
    expect((await prisma.itemImage.findUniqueOrThrow({ where: { id: first.id } })).isPrimary).toBe(true);
    await admin.delete(`/api/admin/items/${item.id}/images/${second.id}`).expect(404);
  });

  it('searches the bid log', async () => {
    const admin = await adminAgent();
    const seller = await createUser();
    const bidder = await createUser({ username: 'sharpbidder' });
    const item = await createItem({ sellerId: seller.id, title: 'Clock' });
    await prisma.bid.create({ data: { itemId: item.id, bidderId: bidder.id, amount: 60, isWinning: true } });

    expect((await admin.get('/api/admin/bids?q=sharp').expect(200)).body.data).toHaveLength(1);
    expect((await admin.get('/api/admin/bids?q=nobody').expect(200)).body.data).toHaveLength(0);
  });
});

describe('admin messages', () => {
  const makeMessage = async () => {
    const user = await createUser();
    const message = await prisma.contactMessage.create({ data: { userId: user.id, name: user.fullName, email: user.email, subject: 'Question', message: 'Where is my order today?' } });
    return { user, message };
  };

  it('marks a new message as read when it is opened', async () => {
    const admin = await adminAgent();
    const { message } = await makeMessage();
    const res = await admin.get(`/api/admin/messages/${message.id}`).expect(200);
    expect(res.body.data.status).toBe('read');
    expect(res.body.data.readAt).not.toBeNull();
  });

  it('replies, records who replied and notifies the author', async () => {
    const admin = await adminAgent();
    const { user, message } = await makeMessage();
    await admin.post(`/api/admin/messages/${message.id}/reply`).send({ replyContent: '' }).expect(400);
    const res = await admin.post(`/api/admin/messages/${message.id}/reply`).send({ replyContent: 'It ships tomorrow.' }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'replied', adminReply: 'It ships tomorrow.' });
    expect(res.body.data.repliedBy).toBeTruthy();
    expect(await prisma.notification.count({ where: { userId: user.id, title: 'We replied to your message' } })).toBe(1);
  });

  it('replies to a visitor message without trying to notify an account', async () => {
    const admin = await adminAgent();
    const message = await prisma.contactMessage.create({ data: { name: 'Guest', email: 'guest@example.com', subject: 'Website enquiry', message: 'How do I list an item?' } });

    const res = await admin.post(`/api/admin/messages/${message.id}/reply`).send({ replyContent: 'Sign up and use Sell.' }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'replied', userId: null });
    expect(await prisma.notification.count()).toBe(0);
  });

  it('filters by status, updates, bulk-updates and deletes', async () => {
    const admin = await adminAgent();
    const a = await makeMessage();
    const b = await makeMessage();
    await prisma.contactMessage.update({ where: { id: b.message.id }, data: { status: 'ARCHIVED' } });

    const fresh = await admin.get('/api/admin/messages?status=NEW').expect(200);
    expect(fresh.body.data).toHaveLength(1);
    expect(fresh.body.meta.counts).toMatchObject({ new: 1, archived: 1 });

    await admin.patch(`/api/admin/messages/${a.message.id}/status`).send({ status: 'ARCHIVED' }).expect(200);
    const bulk = await admin.post('/api/admin/messages/bulk').send({ ids: [a.message.id, b.message.id], action: 'read' }).expect(200);
    expect(bulk.body.data.affected).toBe(2);
    await admin.post('/api/admin/messages/bulk').send({ ids: [], action: 'read' }).expect(400);
    await admin.delete(`/api/admin/messages/${a.message.id}`).expect(204);
    await admin.delete(`/api/admin/messages/${a.message.id}`).expect(404);
  });
});

describe('undoing an approval decision', () => {
  const pendingItem = async () => {
    const seller = await createUser();
    const item = await prisma.item.create({
      data: { sellerId: seller.id, title: 'Awaiting a decision', minBid: 40, currentPrice: 40, bidIncrement: 2, status: 'PENDING', startDate: new Date(), endDate: new Date(Date.now() + 5 * 86_400_000) },
    });
    return { seller, item };
  };

  it('puts an approved listing back in the queue and withdraws the seller notice', async () => {
    const admin = await adminAgent();
    const { seller, item } = await pendingItem();
    await admin.post(`/api/admin/approvals/${item.id}/approve`).send({}).expect(200);
    expect(await prisma.notification.count({ where: { userId: seller.id } })).toBe(1);

    const undone = await admin.post(`/api/admin/approvals/${item.id}/undo`).expect(200);
    expect(undone.body.data.status).toBe('pending');
    expect(await prisma.notification.count({ where: { userId: seller.id } })).toBe(0);
    expect(((await admin.get('/api/admin/approvals').expect(200)).body.data as unknown[]).length).toBe(1);
    await admin.post(`/api/admin/approvals/${item.id}/undo`).expect(400);
  });

  it('undoes a rejection and clears the reason', async () => {
    const admin = await adminAgent();
    const { item } = await pendingItem();
    await admin.post(`/api/admin/approvals/${item.id}/reject`).send({ rejectionReason: 'Photos too dark' }).expect(200);
    const undone = await admin.post(`/api/admin/approvals/${item.id}/undo`).expect(200);
    expect(undone.body.data).toMatchObject({ status: 'pending', rejectionReason: null });
  });

  it('refuses once the window has passed or the lot has bids, and for non-admins', async () => {
    const admin = await adminAgent();
    const { seller, item } = await pendingItem();
    await admin.post(`/api/admin/approvals/${item.id}/approve`).send({}).expect(200);
    await prisma.item.update({ where: { id: item.id }, data: { reviewedAt: new Date(Date.now() - 5 * 60_000) } });
    await admin.post(`/api/admin/approvals/${item.id}/undo`).expect(400);

    await prisma.item.update({ where: { id: item.id }, data: { reviewedAt: new Date() } });
    const bidder = await createUser();
    await prisma.bid.create({ data: { itemId: item.id, bidderId: bidder.id, amount: 42, isWinning: true } });
    await admin.post(`/api/admin/approvals/${item.id}/undo`).expect(400);
    await (await loginAs(seller.email)).post(`/api/admin/approvals/${item.id}/undo`).expect(403);
  });
});

describe('category order', () => {
  it('reorders siblings and serves the new order publicly and to admins', async () => {
    const admin = await adminAgent();
    const [first, second, third] = await Promise.all(['Alpha', 'Bravo', 'Charlie'].map(async name => (await admin.post('/api/admin/categories').send({ name }).expect(201)).body.data as { id: number }));

    const names = async (path: string) => ((await request(app).get(path).expect(200)).body.data as { name: string }[]).map(category => category.name);
    expect(await names('/api/categories')).toEqual(['Alpha', 'Bravo', 'Charlie']);

    await admin.patch('/api/admin/categories/reorder').send({ ids: [third!.id, first!.id, second!.id] }).expect(200);
    expect(await names('/api/categories')).toEqual(['Charlie', 'Alpha', 'Bravo']);
    const adminOrder = ((await admin.get('/api/admin/categories').expect(200)).body.data as { name: string }[]).map(category => category.name);
    expect(adminOrder).toEqual(['Charlie', 'Alpha', 'Bravo']);

    const later = (await admin.post('/api/admin/categories').send({ name: 'Delta' }).expect(201)).body.data as { sortOrder: number };
    expect(later.sortOrder).toBe(3);
  });

  it('rejects unknown, repeated or cross-group ids', async () => {
    const admin = await adminAgent();
    const parent = (await admin.post('/api/admin/categories').send({ name: 'Parent' }).expect(201)).body.data as { id: number };
    const child = (await admin.post('/api/admin/categories').send({ name: 'Child', parentId: parent.id }).expect(201)).body.data as { id: number };
    const other = (await admin.post('/api/admin/categories').send({ name: 'Other' }).expect(201)).body.data as { id: number };

    await admin.patch('/api/admin/categories/reorder').send({ ids: [parent.id, 99999] }).expect(400);
    await admin.patch('/api/admin/categories/reorder').send({ ids: [parent.id, parent.id] }).expect(400);
    await admin.patch('/api/admin/categories/reorder').send({ ids: [child.id, other.id] }).expect(400);
    await admin.patch('/api/admin/categories/reorder').send({ ids: [parent.id] }).expect(400);
    await request(app).patch('/api/admin/categories/reorder').send({ ids: [parent.id, other.id] }).expect(401);
  });
});
