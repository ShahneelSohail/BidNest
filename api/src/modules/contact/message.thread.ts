import type { Prisma } from '@prisma/client';

export const replyInclude = {
  replies: { orderBy: { createdAt: 'asc' }, include: { author: { select: { username: true } } } },
} satisfies Prisma.ContactMessageInclude;

type ThreadReply = Prisma.MessageReplyGetPayload<{ include: { author: { select: { username: true } } } }>;

export const replyDto = (reply: ThreadReply) => ({
  id: reply.id,
  fromAdmin: reply.fromAdmin,
  author: reply.author?.username ?? null,
  body: reply.body,
  createdAt: reply.createdAt,
});
