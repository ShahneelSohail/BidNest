import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { pageQuery } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

const optionalNumber = z.preprocess(value => (value === '' ? undefined : value), z.coerce.number().min(0).optional());
const optionalInt = z.preprocess(value => (value === '' ? undefined : value), z.coerce.number().int().optional());
const optionalDate = z.preprocess(value => (value === '' ? undefined : value), z.coerce.date().optional());

export const itemsQuerySchema = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  categoryId: optionalInt,
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
  status: z.enum(['active', 'ending', 'sold', 'expired', 'all']).default('active'),
  sort: z.enum(['ending', 'newest', 'price_asc', 'price_desc', 'bids']).default('ending'),
  hasBids: z.enum(['true', 'false']).optional(),
  endsAfter: optionalDate,
  endsBefore: optionalDate,
});

export type ItemsQuery = z.infer<typeof itemsQuerySchema>;

const statusFilter = (status: ItemsQuery['status'], now: Date): Prisma.ItemWhereInput => {
  switch (status) {
    case 'active':
      return { status: 'ACTIVE', endDate: { gt: now } };
    case 'ending':
      return { status: 'ACTIVE', endDate: { gt: now, lte: new Date(now.getTime() + DAY_MS) } };
    case 'sold':
      return { status: 'SOLD' };
    case 'expired':
      return { status: 'EXPIRED' };
    default:
      return { status: { in: ['ACTIVE', 'SOLD', 'EXPIRED'] } };
  }
};

const categoryIds = async (categoryId: number): Promise<number[]> => {
  const children = await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
  return [categoryId, ...children.map(child => child.id)];
};

export const buildItemWhere = async (query: ItemsQuery, now = new Date()): Promise<Prisma.ItemWhereInput> => {
  const filters: Prisma.ItemWhereInput[] = [statusFilter(query.status, now)];

  if (query.q) {
    filters.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { category: { name: { contains: query.q, mode: 'insensitive' } } },
      ],
    });
  }
  if (query.categoryId) filters.push({ categoryId: { in: await categoryIds(query.categoryId) } });
  if (query.minPrice !== undefined) filters.push({ currentPrice: { gte: query.minPrice } });
  if (query.maxPrice !== undefined) filters.push({ currentPrice: { lte: query.maxPrice } });
  if (query.hasBids) filters.push({ currentBidId: query.hasBids === 'true' ? { not: null } : null });
  if (query.endsAfter) filters.push({ endDate: { gte: query.endsAfter } });
  if (query.endsBefore) filters.push({ endDate: { lte: query.endsBefore } });

  return { AND: filters };
};

export const buildItemOrder = (sort: ItemsQuery['sort']): Prisma.ItemOrderByWithRelationInput[] => {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'price_asc':
      return [{ currentPrice: 'asc' }, { endDate: 'asc' }];
    case 'price_desc':
      return [{ currentPrice: 'desc' }, { endDate: 'asc' }];
    case 'bids':
      return [{ bids: { _count: 'desc' } }, { endDate: 'asc' }];
    default:
      return [{ featured: 'desc' }, { endDate: 'asc' }];
  }
};
