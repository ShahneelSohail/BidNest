import type { Role, User } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import { forbidden, unauthorized, asyncHandler } from '../lib/http';
import { prisma } from '../lib/prisma';
import { AUTH_COOKIE, verifyToken } from '../lib/tokens';

export type AuthUser = Pick<User, 'id' | 'username' | 'email' | 'fullName' | 'role' | 'isBlocked'>;

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const authSelect = { id: true, username: true, email: true, fullName: true, role: true, isBlocked: true } as const;

export const loadUser = async (req: Request): Promise<AuthUser | null> => {
  const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
  const userId = token ? verifyToken(token) : null;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authSelect });
  return user && !user.isBlocked ? user : null;
};

export const optionalAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  req.user = (await loadUser(req)) ?? undefined;
  next();
});

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
});

export const requireRole = (role: Role): RequestHandler => (req, _res, next) => {
  if (req.user?.role !== role) return next(forbidden());
  next();
};

export const requireAdmin: RequestHandler[] = [requireAuth, requireRole('ADMIN')];

export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw unauthorized();
  return req.user;
};
