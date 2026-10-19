import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, conflict, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const optionalParent = z.preprocess(value => (value === '' || value === undefined ? null : value), z.coerce.number().int().positive().nullable());

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(150, 'Category name cannot exceed 150 characters'),
  parentId: optionalParent,
  isActive: z.boolean().default(true),
});

const mergeSchema = z.object({
  sourceId: z.coerce.number().int().positive(),
  targetId: z.coerce.number().int().positive(),
  deleteSource: z.boolean().default(true),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  showInactive: z.enum(['true', 'false']).default('false'),
});

type Params = z.infer<typeof idParams>;

const assertCategory = async (id: number) => {
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { items: true, children: true } } } });
  if (!category) throw notFound('Category not found.');
  return category;
};

const assertValidParent = async (id: number | null, parentId: number | null) => {
  if (parentId === null) return;
  if (parentId === id) throw badRequest('A category cannot be its own parent.');
  const parent = await assertCategory(parentId);
  if (parent.parentId !== null) throw badRequest('Categories can only be nested one level deep.');
  if (id !== null && (await prisma.category.count({ where: { parentId: id } })) > 0) {
    throw badRequest('A category with subcategories cannot become a subcategory.');
  }
};

export const categoriesRouter = Router();

categoriesRouter.get(
  '/categories',
  validate('query', listQuery),
  asyncHandler(async (req, res) => {
    const { q, showInactive } = req.query as unknown as z.infer<typeof listQuery>;
    const categories = await prisma.category.findMany({
      where: { ...(showInactive === 'true' ? {} : { isActive: true }), ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { parent: { select: { id: true, name: true } }, _count: { select: { items: true, children: true } } },
    });
    res.json({
      data: categories.map(({ _count, ...category }) => ({ ...category, itemCount: _count.items, childCount: _count.children })),
    });
  })
);

categoriesRouter.post(
  '/categories',
  validate('body', categorySchema),
  asyncHandler(async (req, res) => {
    await assertValidParent(null, req.body.parentId);
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ data: category });
  })
);

categoriesRouter.patch(
  '/categories/:id',
  validate('params', idParams),
  validate('body', categorySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await assertCategory(id);
    await assertValidParent(id, req.body.parentId);
    const category = await prisma.category.update({ where: { id }, data: req.body });
    res.json({ data: category });
  })
);

categoriesRouter.patch(
  '/categories/:id/toggle',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const category = await assertCategory(id);
    const updated = await prisma.category.update({ where: { id }, data: { isActive: !category.isActive } });
    res.json({ data: updated });
  })
);

categoriesRouter.delete(
  '/categories/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const category = await assertCategory(id);
    if (category._count.items > 0 || category._count.children > 0) throw conflict('Cannot delete category. It may have items or subcategories.');

    await prisma.category.delete({ where: { id } });
    res.status(204).end();
  })
);

categoriesRouter.post(
  '/categories/merge',
  validate('body', mergeSchema),
  asyncHandler(async (req, res) => {
    const { sourceId, targetId, deleteSource } = req.body as z.infer<typeof mergeSchema>;
    if (sourceId === targetId) throw badRequest('Choose two different categories to merge.');
    const [source, target] = await Promise.all([assertCategory(sourceId), assertCategory(targetId)]);
    if (target.parentId === source.id) throw badRequest('Cannot merge a category into its own subcategory.');

    const moved = await prisma.$transaction(async tx => {
      const items = await tx.item.updateMany({ where: { categoryId: source.id }, data: { categoryId: target.id } });
      await tx.category.updateMany({ where: { parentId: source.id }, data: { parentId: target.parentId === null ? target.id : target.parentId } });
      if (deleteSource) await tx.category.delete({ where: { id: source.id } });
      else await tx.category.update({ where: { id: source.id }, data: { isActive: false } });
      return items.count;
    });
    res.json({ data: { movedItems: moved, sourceDeleted: deleteSource } });
  })
);
