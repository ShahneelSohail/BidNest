import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { asyncHandler, badRequest, conflict, forbidden } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { AUTH_COOKIE, cookieOptions, signToken } from '../../lib/tokens';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { changePasswordSchema, loginSchema, profileSchema, registerSchema } from './auth.schemas';

const BCRYPT_ROUNDS = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 30;

const publicUser = { id: true, username: true, email: true, fullName: true, role: true, createdAt: true } as const;

const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: env.NODE_ENV === 'test' ? 1000 : AUTH_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
});

const startSession = (res: Response, userId: number) => {
  res.cookie(AUTH_COOKIE, signToken(userId), cookieOptions);
};

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate('body', registerSchema),
  asyncHandler(async (req, res) => {
    const { username, email, fullName, password } = req.body;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: { equals: username, mode: 'insensitive' } }] },
      select: { email: true },
    });
    if (existing) throw conflict(existing.email === email ? 'That email is already registered.' : 'That username is taken.');

    const user = await prisma.user.create({
      data: { username, email, fullName, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
      select: publicUser,
    });
    startSession(res, user.id);
    res.status(201).json({ data: user });
  })
);

authRouter.post(
  '/login',
  authLimiter,
  validate('body', loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) throw badRequest('Invalid email or password.');
    if (user.isBlocked) throw forbidden('Your account has been blocked. Please contact support.');

    startSession(res, user.id);
    res.json({ data: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role, createdAt: user.createdAt } });
  })
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id }, select: publicUser });
    res.json({ data: user });
  })
);

authRouter.patch(
  '/me',
  requireAuth,
  validate('body', profileSchema),
  asyncHandler(async (req, res) => {
    const { id } = currentUser(req);
    const { fullName, email } = req.body;
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } });
    if (taken) throw conflict('That email is already registered.');

    const user = await prisma.user.update({ where: { id }, data: { fullName, email }, select: publicUser });
    res.json({ data: user });
  })
);

authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate('body', changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { id } = currentUser(req);
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect.');

    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } });
    res.status(204).end();
  })
);
