import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';

export const categoryRouter = Router();

categoryRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: { where: { status: 'ACTIVE', endDate: { gt: now } } } } } },
    });

    const toNode = (category: (typeof categories)[number]) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      activeItems: category._count.items,
    });
    const roots = categories.filter(category => category.parentId === null);
    const data = roots.map(root => ({
      ...toNode(root),
      children: categories.filter(category => category.parentId === root.id).map(toNode),
    }));
    res.json({ data });
  })
);
