import Stripe from 'stripe';
import { env } from '../config/env';
import { AppError } from './http';

let client: Stripe | undefined;

export const isStripeConfigured = (): boolean => Boolean(env.STRIPE_SECRET_KEY);

export const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(503, 'Card payments are not configured on this server.');
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
};
