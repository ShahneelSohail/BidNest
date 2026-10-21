import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUser, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

export const CHANNELS = ['email', 'push', 'sms'] as const;

const EVENT_GROUPS = [
  { group: 'Bidding', events: [['outbid', "I'm outbid", [true, true, false]], ['ending', 'A lot I bid on ends within an hour', [true, true, false]], ['won', 'I win a lot', [true, true, false]]] },
  { group: 'Selling', events: [['newbid', 'New bid on my listing', [false, true, false]], ['review', 'Listing approved or rejected', [true, true, false]], ['paid', 'Buyer has paid', [true, true, false]]] },
  { group: 'From BidNest', events: [['support', 'Replies from support', [true, true, false]], ['picks', 'Weekly picks for you', [true, false, false]]] },
] as const;

const eventKeys = EVENT_GROUPS.flatMap(group => group.events.map(([key]) => key as string));

const updateSchema = z.object({
  preferences: z.array(z.object({ event: z.string().refine(event => eventKeys.includes(event), 'Unknown event'), channel: z.enum(CHANNELS), enabled: z.boolean() })).min(1).max(eventKeys.length * CHANNELS.length),
});

const loadPreferences = async (userId: number) => {
  const saved = await prisma.notificationPreference.findMany({ where: { userId } });
  return EVENT_GROUPS.map(({ group, events }) => ({
    group,
    events: events.map(([key, label, defaults]) => ({
      key,
      label,
      channels: Object.fromEntries(CHANNELS.map((channel, index) => [channel, saved.find(row => row.event === key && row.channel === channel)?.enabled ?? defaults[index]])),
    })),
  }));
};

export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);

preferencesRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    res.json({ data: await loadPreferences(currentUser(req).id) });
  })
);

preferencesRouter.put(
  '/preferences',
  validate('body', updateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const { preferences } = req.body as z.infer<typeof updateSchema>;
    await prisma.$transaction(
      preferences.map(({ event, channel, enabled }) =>
        prisma.notificationPreference.upsert({ where: { userId_event_channel: { userId, event, channel } }, create: { userId, event, channel, enabled }, update: { enabled } })
      )
    );
    res.json({ data: await loadPreferences(userId) });
  })
);
