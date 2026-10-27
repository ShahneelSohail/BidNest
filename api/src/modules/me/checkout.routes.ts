import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { getStripe, isStripeConfigured } from '../../lib/stripe';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { imageUrl } from '../items/item.dto';
import { DELIVERY_OPTIONS, deliveryKeys, finalizePaidSession, loadCheckoutContext, placeOrder } from './order.service';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const text = (label: string, max = 120) => z.string().trim().min(1, `${label} is required`).max(max);

const addressSchema = z.object({
  label: text('Label', 40),
  name: text('Name'),
  line1: text('Address'),
  line2: z.string().trim().max(120).optional(),
  city: text('City'),
  region: text('State or region'),
  postal: text('Postal code', 20),
  country: text('Country'),
});

const shippingChoice = { addressId: z.coerce.number().int().positive(), delivery: z.enum(deliveryKeys) };

const checkoutSchema = z.object({
  ...shippingChoice,
  payment: z.object({ brand: z.enum(['Visa', 'Mastercard', 'Amex']), last4: z.string().regex(/^\d{4}$/, 'Enter the last 4 digits of the card') }),
});
const sessionSchema = z.object(shippingChoice);
const confirmSchema = z.object({ sessionId: z.string().min(1) });

const toCents = (amount: number) => Math.round(amount * 100);

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

checkoutRouter.get('/payment-config', (_req, res) => {
  res.json({ data: { mode: isStripeConfigured() ? 'stripe' : 'demo' } });
});

checkoutRouter.get('/delivery-options', (_req, res) => {
  res.json({ data: Object.entries(DELIVERY_OPTIONS).map(([key, option]) => ({ key, ...option })) });
});

checkoutRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    res.json({ data: await prisma.address.findMany({ where: { userId: currentUser(req).id }, orderBy: { id: 'asc' } }) });
  })
);

checkoutRouter.post(
  '/addresses',
  validate('body', addressSchema),
  asyncHandler(async (req, res) => {
    const address = await prisma.address.create({ data: { ...req.body, userId: currentUser(req).id } });
    res.status(201).json({ data: address });
  })
);

checkoutRouter.put(
  '/addresses/:id',
  validate('params', idParams),
  validate('body', addressSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const { count } = await prisma.address.updateMany({ where: { id, userId: currentUser(req).id }, data: req.body });
    if (!count) throw notFound('Address not found.');
    res.json({ data: await prisma.address.findUniqueOrThrow({ where: { id } }) });
  })
);

checkoutRouter.delete(
  '/addresses/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    await prisma.address.deleteMany({ where: { id, userId: currentUser(req).id } });
    res.status(204).end();
  })
);

checkoutRouter.post(
  '/won/:id/checkout',
  validate('params', idParams),
  validate('body', checkoutSchema),
  asyncHandler(async (req, res) => {
    if (isStripeConfigured()) throw forbidden('Card payments are handled by Stripe. Use the secure checkout.');
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const { addressId, delivery, payment } = req.body as z.infer<typeof checkoutSchema>;
    const userId = currentUser(req).id;
    const context = await loadCheckoutContext(id, userId, addressId, delivery);
    const order = await placeOrder({ ...context, userId, paymentLabel: `${payment.brand} ending ${payment.last4}` });
    res.status(201).json({ data: { id, receiptNo: order.receiptNo, paidAt: order.paidAt, amount: money(order.total) } });
  })
);

checkoutRouter.post(
  '/won/:id/checkout-session',
  validate('params', idParams),
  validate('body', sessionSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const { addressId, delivery } = req.body as z.infer<typeof sessionSchema>;
    const userId = currentUser(req).id;
    const stripe = getStripe();
    const { item, delivery: shipping } = await loadCheckoutContext(id, userId, addressId, delivery);

    const image = await prisma.itemImage.findFirst({ where: { itemId: id, isPrimary: true } });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(id),
      customer_email: currentUser(req).email,
      line_items: [
        { quantity: 1, price_data: { currency: 'usd', unit_amount: toCents(Number(item.currentPrice)), product_data: { name: item.title, images: image && image.url.startsWith('http') ? [image.url] : image ? [imageUrl(image.url)] : [] } } },
        { quantity: 1, price_data: { currency: 'usd', unit_amount: toCents(shipping.cost), product_data: { name: shipping.label } } },
      ],
      metadata: { itemId: String(id), userId: String(userId), addressId: String(addressId), delivery },
      success_url: `${env.WEB_URL}/checkout/${id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_URL}/checkout/${id}?cancelled=1`,
    });
    if (!session.url) throw badRequest('Could not start the payment. Please try again.');
    res.status(201).json({ data: { url: session.url } });
  })
);

checkoutRouter.post(
  '/won/:id/confirm-payment',
  validate('params', idParams),
  validate('body', confirmSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const userId = currentUser(req).id;
    const session = await getStripe().checkout.sessions.retrieve((req.body as z.infer<typeof confirmSchema>).sessionId);
    if (Number(session.metadata?.itemId) !== id || Number(session.metadata?.userId) !== userId) throw notFound('Payment not found.');

    const order = await finalizePaidSession(session);
    if (!order) throw badRequest('This payment has not completed yet.');
    res.json({ data: { id, receiptNo: order.receiptNo, paidAt: order.paidAt, amount: money(order.total) } });
  })
);

checkoutRouter.get(
  '/orders/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const order = await prisma.order.findFirst({ where: { itemId: id, buyerId: currentUser(req).id }, include: { item: { select: { id: true, title: true } } } });
    if (!order) throw notFound('Order not found.');
    res.json({
      data: {
        receiptNo: order.receiptNo,
        item: order.item,
        shippingTo: order.shippingTo,
        deliveryMethod: order.deliveryMethod,
        itemPrice: money(order.itemPrice),
        shippingCost: money(order.shippingCost),
        total: money(order.total),
        paymentLabel: order.paymentLabel,
        paidAt: order.paidAt,
      },
    });
  })
);
