import request from 'supertest';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WEBHOOK_SECRET = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  return 'whsec_test_secret';
});

import { prisma } from '../src/lib/prisma';
import { getStripe } from '../src/lib/stripe';
import { closeAuction } from '../src/modules/auctions/auction.service';
import { address, app, createItem, createUser, loginAs, resetDb } from './helpers';

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
});

const wonLot = async () => {
  const [seller, buyer, other] = await Promise.all([createUser(), createUser(), createUser()]);
  const item = await createItem({ sellerId: seller.id });
  const buyerAgent = await loginAs(buyer.email);
  await buyerAgent.post(`/api/items/${item.id}/bids`).send({ amount: 80 }).expect(201);
  await closeAuction(item.id);
  const { id: addressId } = (await buyerAgent.post('/api/me/addresses').send(address).expect(201)).body.data as { id: number };
  return { seller, buyer, other, item, buyerAgent, otherAgent: await loginAs(other.email), addressId };
};

const paidSession = (itemId: number, userId: number, addressId: number, overrides: Partial<Stripe.Checkout.Session> = {}) =>
  ({ id: 'cs_test_123', payment_status: 'paid', payment_intent: 'pi_test_123', metadata: { itemId: String(itemId), userId: String(userId), addressId: String(addressId), delivery: 'standard' }, ...overrides }) as unknown as Stripe.Checkout.Session;

const stubPaymentMethod = () =>
  vi.spyOn(getStripe().paymentIntents, 'retrieve').mockResolvedValue({ payment_method: { card: { brand: 'visa', last4: '4242' } } } as unknown as Stripe.Response<Stripe.PaymentIntent>);

const signedWebhook = (session: Stripe.Checkout.Session, type = 'checkout.session.completed', secret = WEBHOOK_SECRET) => {
  const payload = JSON.stringify({ id: 'evt_test_1', object: 'event', type, data: { object: session } });
  const header = getStripe().webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post('/api/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', header).send(payload);
};

describe('stripe checkout', () => {
  it('reports card mode and turns off the demo checkout', async () => {
    const { buyerAgent, item, addressId } = await wonLot();
    expect((await buyerAgent.get('/api/me/payment-config').expect(200)).body.data.mode).toBe('stripe');
    await buyerAgent.post(`/api/me/won/${item.id}/checkout`).send({ addressId, delivery: 'standard', payment: { brand: 'Visa', last4: '4242' } }).expect(403);
    expect(await prisma.order.count()).toBe(0);
  });

  it('starts a hosted checkout with the lot, delivery and return links', async () => {
    const { buyerAgent, otherAgent, buyer, item, addressId } = await wonLot();
    const create = vi.spyOn(getStripe().checkout.sessions, 'create').mockResolvedValue({ url: 'https://checkout.stripe.test/pay/cs_test_123' } as Stripe.Response<Stripe.Checkout.Session>);

    const res = await buyerAgent.post(`/api/me/won/${item.id}/checkout-session`).send({ addressId, delivery: 'express' }).expect(201);
    expect(res.body.data.url).toBe('https://checkout.stripe.test/pay/cs_test_123');
    const params = create.mock.calls[0]![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.mode).toBe('payment');
    expect(params.line_items!.map(line => (line.price_data as { unit_amount: number }).unit_amount)).toEqual([8000, 14000]);
    expect(params.metadata).toEqual({ itemId: String(item.id), userId: String(buyer.id), addressId: String(addressId), delivery: 'express' });
    expect(params.success_url).toContain(`/checkout/${item.id}?session_id={CHECKOUT_SESSION_ID}`);
    expect(params.cancel_url).toContain(`/checkout/${item.id}?cancelled=1`);

    await otherAgent.post(`/api/me/won/${item.id}/checkout-session`).send({ addressId, delivery: 'express' }).expect(404);
    await buyerAgent.post(`/api/me/won/${item.id}/checkout-session`).send({ addressId: 999999, delivery: 'express' }).expect(404);
  });

  it('records the order once when the buyer returns and the webhook also arrives', async () => {
    const { buyerAgent, seller, buyer, item, addressId } = await wonLot();
    const session = paidSession(item.id, buyer.id, addressId);
    vi.spyOn(getStripe().checkout.sessions, 'retrieve').mockResolvedValue(session as Stripe.Response<Stripe.Checkout.Session>);
    stubPaymentMethod();

    const confirmed = await buyerAgent.post(`/api/me/won/${item.id}/confirm-payment`).send({ sessionId: 'cs_test_123' }).expect(200);
    expect(confirmed.body.data).toMatchObject({ amount: 165, receiptNo: expect.stringMatching(/^BN-\d{6}$/) });
    await signedWebhook(session).expect(200);
    await buyerAgent.post(`/api/me/won/${item.id}/confirm-payment`).send({ sessionId: 'cs_test_123' }).expect(200);

    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.notification.count({ where: { userId: seller.id, title: 'Payment received' } })).toBe(1);
    const receipt = (await buyerAgent.get(`/api/me/orders/${item.id}`).expect(200)).body.data;
    expect(receipt).toMatchObject({ total: 165, paymentLabel: 'Visa ending 4242', shippingTo: { city: 'Brooklyn' } });
    expect((await prisma.order.findFirstOrThrow()).stripeSessionId).toBe('cs_test_123');
  });

  it('finishes the order from the webhook alone', async () => {
    const { buyer, item, addressId } = await wonLot();
    stubPaymentMethod();
    await signedWebhook(paidSession(item.id, buyer.id, addressId)).expect(200);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).paidAt).not.toBeNull();
    expect(await prisma.order.count()).toBe(1);
  });

  it('refuses another buyer’s session, an unpaid session, and forged or unrelated webhooks', async () => {
    const { buyerAgent, otherAgent, buyer, item, addressId } = await wonLot();
    const retrieve = vi.spyOn(getStripe().checkout.sessions, 'retrieve');

    retrieve.mockResolvedValue(paidSession(item.id, buyer.id, addressId) as Stripe.Response<Stripe.Checkout.Session>);
    await otherAgent.post(`/api/me/won/${item.id}/confirm-payment`).send({ sessionId: 'cs_test_123' }).expect(404);

    retrieve.mockResolvedValue(paidSession(item.id, buyer.id, addressId, { payment_status: 'unpaid' }) as Stripe.Response<Stripe.Checkout.Session>);
    await buyerAgent.post(`/api/me/won/${item.id}/confirm-payment`).send({ sessionId: 'cs_test_123' }).expect(400);

    const session = paidSession(item.id, buyer.id, addressId);
    await signedWebhook(session, 'checkout.session.completed', 'whsec_wrong').expect(400);
    await request(app).post('/api/webhooks/stripe').set('content-type', 'application/json').send('{}').expect(400);
    await signedWebhook(session, 'customer.created').expect(200);
    expect(await prisma.order.count()).toBe(0);
  });
});
