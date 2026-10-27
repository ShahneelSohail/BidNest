import type { Address, Item } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { conflict, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getStripe } from '../../lib/stripe';
import { notify } from '../notifications/notification.service';
import { wonWhere } from './won';

export const DELIVERY_OPTIONS = {
  standard: { label: 'Insured courier', detail: '3–5 business days, signature on delivery', cost: 85 },
  express: { label: 'Express insured', detail: '1–2 business days, priority handling', cost: 140 },
} as const;

export type DeliveryKey = keyof typeof DELIVERY_OPTIONS;
export const deliveryKeys = Object.keys(DELIVERY_OPTIONS) as [DeliveryKey, ...DeliveryKey[]];

const receiptNumber = (orderId: number) => `BN-${String(orderId).padStart(6, '0')}`;

export const loadCheckoutContext = async (itemId: number, userId: number, addressId: number, delivery: DeliveryKey) => {
  const item = await prisma.item.findFirst({ where: { id: itemId, ...wonWhere(userId) } });
  if (!item) throw notFound('Won auction not found.');
  if (item.paidAt) throw conflict('This auction has already been paid.');
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw notFound('Choose a delivery address.');
  return { item, address, delivery: DELIVERY_OPTIONS[delivery] };
};

interface PlaceOrder {
  item: Item;
  userId: number;
  address: Address;
  delivery: (typeof DELIVERY_OPTIONS)[DeliveryKey];
  paymentLabel: string;
  stripeSessionId?: string;
}

export const placeOrder = async ({ item, userId, address, delivery, paymentLabel, stripeSessionId }: PlaceOrder) => {
  const itemPrice = Number(item.currentPrice);
  const order = await prisma.$transaction(async tx => {
    await tx.item.update({ where: { id: item.id }, data: { paidAt: new Date() } });
    const created = await tx.order.create({
      data: {
        itemId: item.id,
        buyerId: userId,
        receiptNo: `PENDING-${item.id}`,
        shippingTo: { label: address.label, name: address.name, line1: address.line1, line2: address.line2, city: address.city, region: address.region, postal: address.postal, country: address.country },
        deliveryMethod: delivery.label,
        itemPrice,
        shippingCost: delivery.cost,
        total: itemPrice + delivery.cost,
        paymentLabel,
        stripeSessionId,
      },
    });
    return tx.order.update({ where: { id: created.id }, data: { receiptNo: receiptNumber(created.id) } });
  });
  await notify({ userId: item.sellerId, title: 'Payment received', message: `The buyer paid $${Number(order.total).toFixed(2)} for "${item.title}". Ship within 3 business days.`, link: `/auctions/${item.id}` });
  return order;
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const describePayment = async (session: Stripe.Checkout.Session): Promise<string> => {
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) return 'Card payment';
  const intent = await getStripe().paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
  const card = typeof intent.payment_method === 'object' ? intent.payment_method?.card : undefined;
  return card ? `${capitalise(card.brand)} ending ${card.last4}` : 'Card payment';
};

// Both the webhook and the return-from-Stripe confirmation call this, so it must be safe to run twice.
export const finalizePaidSession = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== 'paid') return null;
  const itemId = Number(session.metadata?.itemId);
  const userId = Number(session.metadata?.userId);
  const addressId = Number(session.metadata?.addressId);
  const delivery = session.metadata?.delivery as DeliveryKey | undefined;
  if (!itemId || !userId || !addressId || !delivery || !(delivery in DELIVERY_OPTIONS)) return null;

  const existing = await prisma.order.findUnique({ where: { itemId } });
  if (existing) return existing;

  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
  const address = await prisma.address.findFirstOrThrow({ where: { id: addressId, userId } });
  try {
    return await placeOrder({ item, userId, address, delivery: DELIVERY_OPTIONS[delivery], paymentLabel: await describePayment(session), stripeSessionId: session.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.order.findUnique({ where: { itemId } });
    throw error;
  }
};
