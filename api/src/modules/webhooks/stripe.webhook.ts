import type Stripe from 'stripe';
import { env } from '../../config/env';
import { asyncHandler, badRequest } from '../../lib/http';
import { getStripe } from '../../lib/stripe';
import { finalizePaidSession } from '../me/order.service';

const PAID_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];

export const stripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!env.STRIPE_WEBHOOK_SECRET || typeof signature !== 'string') throw badRequest('Missing webhook signature.');

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw badRequest('Invalid webhook signature.');
  }

  if (PAID_EVENTS.includes(event.type)) await finalizePaidSession(event.data.object as Stripe.Checkout.Session);
  res.json({ received: true });
});
