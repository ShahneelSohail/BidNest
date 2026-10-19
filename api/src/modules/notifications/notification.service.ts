import { prisma } from '../../lib/prisma';
import { emitToUser } from '../../realtime/hub';

interface NotificationInput {
  userId: number;
  title: string;
  message: string;
  link?: string;
}

export const notify = async (input: NotificationInput) => {
  const notification = await prisma.notification.create({ data: input });
  emitToUser(input.userId, 'notification:new', notification);
  return notification;
};

export const notifyMany = async (inputs: NotificationInput[]) => {
  await Promise.all(inputs.map(notify));
};
