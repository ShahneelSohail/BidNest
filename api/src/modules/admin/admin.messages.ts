import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, notFound } from '../../lib/http';
import { pageMeta, pageQuery, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { currentUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { notify } from '../notifications/notification.service';

const STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] as const;
const idParams = z.object({ id: z.coerce.number().int().positive() });

const messagesQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
  status: z.enum(['all', ...STATUSES]).default('all'),
});
const replySchema = z.object({ replyContent: z.string().trim().min(1, 'Reply cannot be empty').max(2000) });
const statusSchema = z.object({ status: z.enum(STATUSES) });
const bulkSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  action: z.enum(['read', 'archive', 'delete']),
});

type Params = z.infer<typeof idParams>;

const dto = (message: Awaited<ReturnType<typeof findMessage>>) => ({
  id: message.id,
  userId: message.userId,
  name: message.name,
  email: message.email,
  subject: message.subject,
  message: message.message,
  newsletterSubscription: message.newsletterSubscription,
  status: message.status.toLowerCase(),
  adminReply: message.adminReply,
  repliedAt: message.repliedAt,
  repliedBy: message.repliedBy?.username ?? null,
  readAt: message.readAt,
  createdAt: message.createdAt,
});

const findMessage = async (id: number) => {
  const message = await prisma.contactMessage.findUnique({ where: { id }, include: { repliedBy: { select: { username: true } } } });
  if (!message) throw notFound('Message not found.');
  return message;
};

export const messagesRouter = Router();

messagesRouter.get(
  '/messages',
  validate('query', messagesQuery),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof messagesQuery>;
    const where = query.status === 'all' ? {} : { status: query.status };
    const [messages, total, counts] = await Promise.all([
      prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, include: { repliedBy: { select: { username: true } } }, ...paginate(query) }),
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(counts.map(entry => [entry.status.toLowerCase(), entry._count._all]));
    res.json({ data: messages.map(dto), meta: { ...pageMeta(query.page, query.pageSize, total), counts: byStatus } });
  })
);

messagesRouter.get(
  '/messages/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const message = await findMessage(id);
    if (message.status === 'NEW') {
      await prisma.contactMessage.update({ where: { id }, data: { status: 'READ', readAt: new Date() } });
      return res.json({ data: dto(await findMessage(id)) });
    }
    res.json({ data: dto(message) });
  })
);

messagesRouter.post(
  '/messages/:id/reply',
  validate('params', idParams),
  validate('body', replySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    const message = await findMessage(id);
    await prisma.contactMessage.update({
      where: { id },
      data: { adminReply: req.body.replyContent, status: 'REPLIED', repliedAt: new Date(), repliedByUserId: currentUser(req).id, readAt: message.readAt ?? new Date() },
    });
    await notify({ userId: message.userId, title: 'We replied to your message', message: `Re: ${message.subject}`, link: '/dashboard/messages' });
    res.json({ data: dto(await findMessage(id)) });
  })
);

messagesRouter.patch(
  '/messages/:id/status',
  validate('params', idParams),
  validate('body', statusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await findMessage(id);
    await prisma.contactMessage.update({ where: { id }, data: { status: req.body.status } });
    res.json({ data: dto(await findMessage(id)) });
  })
);

messagesRouter.post(
  '/messages/bulk',
  validate('body', bulkSchema),
  asyncHandler(async (req, res) => {
    const { ids, action } = req.body as z.infer<typeof bulkSchema>;
    const where = { id: { in: ids } };
    const result =
      action === 'delete'
        ? await prisma.contactMessage.deleteMany({ where })
        : await prisma.contactMessage.updateMany({ where, data: action === 'read' ? { status: 'READ', readAt: new Date() } : { status: 'ARCHIVED' } });
    res.json({ data: { affected: result.count } });
  })
);

messagesRouter.delete(
  '/messages/:id',
  validate('params', idParams),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as Params;
    await findMessage(id);
    await prisma.contactMessage.delete({ where: { id } });
    res.status(204).end();
  })
);
