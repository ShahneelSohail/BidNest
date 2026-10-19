import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const AUTH_COOKIE = 'bidnest_token';

interface TokenPayload {
  sub: number;
}

export const signToken = (userId: number): string =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

export const verifyToken = (token: string): number | null => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
    return typeof payload.sub === 'number' ? payload.sub : null;
  } catch {
    return null;
  }
};

export const readCookie = (header: string | undefined, name: string): string | undefined =>
  header
    ?.split(';')
    .map(part => part.trim().split('='))
    .find(([key]) => key === name)?.[1];

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};
