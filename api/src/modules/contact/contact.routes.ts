import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const CONTACT_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_MAX_PER_WINDOW = 10;

const contactSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject cannot exceed 200 characters'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters long').max(2000, 'Message cannot exceed 2000 characters'),
  newsletter: z.coerce.boolean().default(false),
});

const contactLimiter = rateLimit({
  windowMs: CONTACT_WINDOW_MS,
  limit: env.NODE_ENV === 'test' ? 1000 : CONTACT_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many messages. Please try again later.' } },
});

export const contactRouter = Router();

contactRouter.post(
  '/',
  requireAuth,
  contactLimiter,
  validate('body', contactSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { subject, message, newsletter } = req.body;
    const created = await prisma.contactMessage.create({
      data: { userId: user.id, name: user.fullName, email: user.email, subject, message, newsletterSubscription: newsletter },
    });
    res.status(201).json({ data: { id: created.id } });
  })
);
