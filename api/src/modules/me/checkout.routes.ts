import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, conflict, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { money } from '../../lib/serialize';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { notify } from '../notifications/notification.service';
import { wonWhere } from './won';

const DELIVERY_OPTIONS = {
  standard: { label: 'Insured courier', detail: '3–5 business days, signature on delivery', cost: 85 },
  express: { label: 'Express insured', detail: '1–2 business days, priority handling', cost: 140 },
} as const;

type DeliveryKey = keyof typeof DELIVERY_OPTIONS;
const deliveryKeys = Object.keys(DELIVERY_OPTIONS) as [DeliveryKey, ...DeliveryKey[]];

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

const checkoutSchema = z.object({
  addressId: z.coerce.number().int().positive(),
  delivery: z.enum(deliveryKeys),
  payment: z.object({ brand: z.enum(['Visa', 'Mastercard', 'Amex']), last4: z.string().regex(/^\d{4}$/, 'Enter the last 4 digits of the card') }),
});

const receiptNumber = (orderId: number) => `BN-${String(orderId).padStart(6, '0')}`;

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

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
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const { addressId, delivery, payment } = req.body as z.infer<typeof checkoutSchema>;
    const userId = currentUser(req).id;
    const item = await prisma.item.findFirst({ where: { id, ...wonWhere(userId) } });
    if (!item) throw notFound('Won auction not found.');
    if (item.paidAt) throw conflict('This auction has already been paid.');
    const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw notFound('Choose a delivery address.');

    const { cost } = DELIVERY_OPTIONS[delivery];
    const itemPrice = Number(item.currentPrice);
    const order = await prisma.$transaction(async tx => {
      await tx.item.update({ where: { id }, data: { paidAt: new Date() } });
      const created = await tx.order.create({
        data: {
          itemId: id,
          buyerId: userId,
          receiptNo: `PENDING-${id}`,
          shippingTo: { label: address.label, name: address.name, line1: address.line1, line2: address.line2, city: address.city, region: address.region, postal: address.postal, country: address.country },
          deliveryMethod: DELIVERY_OPTIONS[delivery].label,
          itemPrice,
          shippingCost: cost,
          total: itemPrice + cost,
          paymentLabel: `${payment.brand} ending ${payment.last4}`,
        },
      });
      return tx.order.update({ where: { id: created.id }, data: { receiptNo: receiptNumber(created.id) } });
    });
    await notify({ userId: item.sellerId, title: 'Payment received', message: `The buyer paid $${Number(order.total).toFixed(2)} for "${item.title}". Ship within 3 business days.`, link: `/auctions/${id}` });
    res.status(201).json({ data: { id, receiptNo: order.receiptNo, paidAt: order.paidAt, amount: money(order.total) } });
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
