import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

export const PASSWORD = 'Password123!';

export const resetDb = async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'`;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
};

let counter = 0;

export const createUser = async (overrides: { role?: Role; isBlocked?: boolean; username?: string; email?: string; fullName?: string } = {}) => {
  counter += 1;
  return prisma.user.create({
    data: {
      username: overrides.username ?? `user${counter}`,
      email: overrides.email ?? `user${counter}@example.com`,
      fullName: overrides.fullName ?? `Test User ${counter}`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: overrides.role ?? 'USER',
      isBlocked: overrides.isBlocked ?? false,
    },
  });
};

export const loginAs = async (email: string) => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
};

export const createCategory = (name = 'Electronics') => prisma.category.create({ data: { name } });

interface ItemOverrides {
  sellerId: number;
  categoryId?: number;
  title?: string;
  status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SOLD' | 'EXPIRED';
  minBid?: number;
  bidIncrement?: number;
  endsInHours?: number;
}

export const createItem = (overrides: ItemOverrides) => {
  const { sellerId, categoryId, title = 'Vintage camera body', status = 'ACTIVE', minBid = 50, bidIncrement = 5, endsInHours = 48 } = overrides;
  const now = Date.now();
  return prisma.item.create({
    data: {
      sellerId,
      categoryId,
      title,
      description: 'A well preserved item that is ready for its next owner.',
      minBid,
      currentPrice: minBid,
      bidIncrement,
      status,
      startDate: new Date(now - 60 * 60 * 1000),
      endDate: new Date(now + endsInHours * 60 * 60 * 1000),
    },
  });
};
