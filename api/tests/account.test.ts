import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/upload';
import { closeAuction } from '../src/modules/auctions/auction.service';
import { address, app, checkout, createItem, createUser, loginAs, resetDb } from './helpers';
import request from 'supertest';

beforeEach(resetDb);

describe('addresses and checkout', () => {
  it('keeps addresses private to their owner', async () => {
    const [alice, bob] = await Promise.all([createUser(), createUser()]);
    const aliceAgent = await loginAs(alice.email);
    const bobAgent = await loginAs(bob.email);
    const { id } = (await aliceAgent.post('/api/me/addresses').send(address).expect(201)).body.data as { id: number };

    expect(((await bobAgent.get('/api/me/addresses').expect(200)).body.data as unknown[]).length).toBe(0);
    await bobAgent.put(`/api/me/addresses/${id}`).send(address).expect(404);
    await aliceAgent.put(`/api/me/addresses/${id}`).send({ ...address, label: 'Studio' }).expect(200);
    await aliceAgent.delete(`/api/me/addresses/${id}`).expect(204);
    expect(((await aliceAgent.get('/api/me/addresses').expect(200)).body.data as unknown[]).length).toBe(0);
  });

  it('rejects an incomplete address', async () => {
    const agent = await loginAs((await createUser()).email);
    await agent.post('/api/me/addresses').send({ ...address, city: '' }).expect(400);
  });

  it('prices delivery, stores a receipt and lets only the buyer read it', async () => {
    const [seller, alice, bob] = await Promise.all([createUser(), createUser(), createUser()]);
    const item = await createItem({ sellerId: seller.id });
    const aliceAgent = await loginAs(alice.email);
    await aliceAgent.post(`/api/items/${item.id}/bids`).send({ amount: 100 }).expect(201);
    await closeAuction(item.id);

    const options = (await aliceAgent.get('/api/me/delivery-options').expect(200)).body.data as { key: string; cost: number }[];
    expect(options.map(option => option.key)).toEqual(['standard', 'express']);

    const { id: addressId } = (await aliceAgent.post('/api/me/addresses').send(address).expect(201)).body.data as { id: number };
    await aliceAgent.post(`/api/me/won/${item.id}/checkout`).send({ addressId, delivery: 'express', payment: { brand: 'Visa', last4: '12' } }).expect(400);
    await checkout(aliceAgent, item.id).then(res => expect(res.status).toBe(201));

    const receipt = (await aliceAgent.get(`/api/me/orders/${item.id}`).expect(200)).body.data;
    expect(receipt).toMatchObject({ itemPrice: 100, shippingCost: 85, total: 185, paymentLabel: 'Visa ending 4242', shippingTo: { city: 'Brooklyn' } });
    await (await loginAs(bob.email)).get(`/api/me/orders/${item.id}`).expect(404);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe('profile and notification preferences', () => {
  it('saves the extended profile', async () => {
    const user = await createUser();
    const agent = await loginAs(user.email);
    const res = await agent.patch('/api/auth/me').send({ fullName: 'Elena Marsh', email: user.email, location: 'Brooklyn', bio: 'Cameras and watches.', isPublic: false }).expect(200);
    expect(res.body.data).toMatchObject({ location: 'Brooklyn', bio: 'Cameras and watches.', isPublic: false });
    await agent.patch('/api/auth/me').send({ fullName: 'Elena Marsh', email: user.email, bio: 'x'.repeat(301) }).expect(400);
  });

  it('returns defaults, stores changes per user and rejects unknown events', async () => {
    const [alice, bob] = await Promise.all([createUser(), createUser()]);
    const aliceAgent = await loginAs(alice.email);
    const defaults = (await aliceAgent.get('/api/me/preferences').expect(200)).body.data as { events: { key: string; channels: Record<string, boolean> }[] }[];
    expect(defaults.flatMap(group => group.events).find(event => event.key === 'outbid')?.channels).toEqual({ email: true, push: true, sms: false });

    await aliceAgent.put('/api/me/preferences').send({ preferences: [{ event: 'outbid', channel: 'sms', enabled: true }] }).expect(200);
    await aliceAgent.put('/api/me/preferences').send({ preferences: [{ event: 'nope', channel: 'sms', enabled: true }] }).expect(400);

    const read = async (agent: Awaited<ReturnType<typeof loginAs>>) =>
      ((await agent.get('/api/me/preferences').expect(200)).body.data as { events: { key: string; channels: Record<string, boolean> }[] }[]).flatMap(group => group.events).find(event => event.key === 'outbid')?.channels.sms;
    expect(await read(aliceAgent)).toBe(true);
    expect(await read(await loginAs(bob.email))).toBe(false);
  });
});

describe('browse filters and listing details', () => {
  it('filters by ending window and featured, and attaches the seller', async () => {
    const seller = await createUser();
    await createItem({ sellerId: seller.id, title: 'Ending soon', endsInHours: 0.5 });
    await createItem({ sellerId: seller.id, title: 'Later lot', endsInHours: 72 });
    const featured = await createItem({ sellerId: seller.id, title: 'Star lot', endsInHours: 96 });
    await prisma.item.update({ where: { id: featured.id }, data: { featured: true } });

    const titles = async (status: string) => ((await request(app).get(`/api/items?status=${status}`).expect(200)).body.data as { title: string }[]).map(item => item.title);
    expect(await titles('hour')).toEqual(['Ending soon']);
    expect(await titles('featured')).toEqual(['Star lot']);
    const [first] = (await request(app).get('/api/items').expect(200)).body.data as { seller: { username: string; rating: number | null } }[];
    expect(first?.seller).toMatchObject({ username: seller.username, rating: null });
  });

  it('counts views from visitors but not from the seller', async () => {
    const seller = await createUser();
    const item = await createItem({ sellerId: seller.id });
    await request(app).get(`/api/items/${item.id}`).expect(200);
    await request(app).get(`/api/items/${item.id}`).expect(200);
    await (await loginAs(seller.email)).get(`/api/items/${item.id}`).expect(200);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).viewCount).toBe(2);
  });

  it('stores condition and a chosen bid increment on new listings', async () => {
    const agent = await loginAs((await createUser()).email);
    const res = await agent.post('/api/seller/items').field('title', 'Leica M3 double-stroke').field('minBid', '900').field('durationDays', '5').field('condition', 'Excellent').field('increment', '50');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ condition: 'Excellent', bidIncrement: 50 });
    await agent.post('/api/seller/items').field('title', 'Leica M3 double-stroke').field('minBid', '900').field('durationDays', '5').field('condition', 'Pristine').expect(400);
  });

  it('reports daily earnings for the chosen window', async () => {
    const seller = await createUser();
    const agent = await loginAs(seller.email);
    const sold = await createItem({ sellerId: seller.id, status: 'SOLD', minBid: 300 });
    await prisma.item.update({ where: { id: sold.id }, data: { endDate: new Date() } });

    const thirty = (await agent.get('/api/seller/analytics?days=30').expect(200)).body.data.dailyEarnings as { earnings: number }[];
    expect(thirty).toHaveLength(30);
    expect(thirty.at(-1)?.earnings).toBe(300);
    await agent.get('/api/seller/analytics?days=7').expect(400);
  });
});

describe('support conversations', () => {
  it('builds a thread of staff replies and buyer follow-ups, and notifies the other side', async () => {
    const [alice, bob, admin] = await Promise.all([createUser(), createUser(), createUser({ role: 'ADMIN' })]);
    const aliceAgent = await loginAs(alice.email);
    const adminAgent = await loginAs(admin.email);
    await aliceAgent.post('/api/contact').send({ subject: 'Shipping question', message: 'How long does shipping usually take?' }).expect(201);
    const id = (await prisma.contactMessage.findFirstOrThrow({ where: { userId: alice.id } })).id;

    await adminAgent.post(`/api/admin/messages/${id}/reply`).send({ replyContent: 'Usually 3 to 5 business days.' }).expect(200);
    await aliceAgent.post(`/api/me/messages/${id}/replies`).send({ body: '' }).expect(400);
    const followUp = await aliceAgent.post(`/api/me/messages/${id}/replies`).send({ body: 'Does that include weekends?' }).expect(201);
    expect(followUp.body.data).toMatchObject({ fromAdmin: false, body: 'Does that include weekends?' });
    expect(await prisma.notification.count({ where: { userId: admin.id, title: 'New reply on a support message' } })).toBe(1);

    const mine = (await aliceAgent.get('/api/me/messages').expect(200)).body.data[0] as { status: string; replies: { fromAdmin: boolean; body: string }[] };
    expect(mine.status).toBe('new');
    expect(mine.replies.map(reply => [reply.fromAdmin, reply.body])).toEqual([[true, 'Usually 3 to 5 business days.'], [false, 'Does that include weekends?']]);

    const adminView = (await adminAgent.get(`/api/admin/messages/${id}`).expect(200)).body.data as { replies: unknown[] };
    expect(adminView.replies).toHaveLength(2);
    expect(await prisma.notification.count({ where: { userId: alice.id, title: 'We replied to your message' } })).toBe(1);

    await (await loginAs(bob.email)).post(`/api/me/messages/${id}/replies`).send({ body: 'Not my thread' }).expect(404);
  });
});

describe('profile photo', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const created = new Set<string>();
  const remember = (url: string | null) => url && created.add(path.basename(url));
  const fileExists = (url: string) => fs.existsSync(path.join(UPLOAD_DIR, path.basename(url)));

  afterAll(() => {
    for (const file of created) fs.rmSync(path.join(UPLOAD_DIR, file), { force: true });
  });

  it('uploads a photo, replaces the old file, shows it on the profile and the lot seller card, and removes it', async () => {
    const seller = await createUser();
    const agent = await loginAs(seller.email);
    const first = (await agent.post('/api/auth/me/avatar').attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' }).expect(200)).body.data.avatarUrl as string;
    remember(first);
    expect(first).toMatch(/\/uploads\/.+\.png$/);
    expect((await agent.get('/api/auth/me').expect(200)).body.data.avatarUrl).toBe(first);

    const second = (await agent.post('/api/auth/me/avatar').attach('avatar', PNG, { filename: 'again.png', contentType: 'image/png' }).expect(200)).body.data.avatarUrl as string;
    remember(second);
    expect(second).not.toBe(first);
    expect(fileExists(first)).toBe(false);
    expect(fileExists(second)).toBe(true);

    const item = await createItem({ sellerId: seller.id });
    expect((await request(app).get(`/api/items/${item.id}`).expect(200)).body.data.seller.avatarUrl).toBe(second);

    expect((await agent.delete('/api/auth/me/avatar').expect(200)).body.data.avatarUrl).toBeNull();
    expect(fileExists(second)).toBe(false);
  });

  it('requires a sign-in, a file and an image', async () => {
    await request(app).post('/api/auth/me/avatar').attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' }).expect(401);
    const agent = await loginAs((await createUser()).email);
    await agent.post('/api/auth/me/avatar').expect(400);
    await agent.post('/api/auth/me/avatar').attach('avatar', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' }).expect(400);
  });
});
