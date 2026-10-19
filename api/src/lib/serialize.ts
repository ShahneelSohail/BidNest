import type { Prisma } from '@prisma/client';

export const money = (value: Prisma.Decimal | number | string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

export const toMoney = (value: Prisma.Decimal | number | string): number => Number(value);
