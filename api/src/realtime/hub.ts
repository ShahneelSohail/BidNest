import type { Server } from 'socket.io';

let io: Server | null = null;

export const attachHub = (server: Server): void => {
  io = server;
};

export const auctionRoom = (itemId: number) => `auction:${itemId}`;
export const userRoom = (userId: number) => `user:${userId}`;

export const emitToAuction = (itemId: number, event: string, payload: unknown): void => {
  io?.to(auctionRoom(itemId)).emit(event, payload);
};

export const emitToUser = (userId: number, event: string, payload: unknown): void => {
  io?.to(userRoom(userId)).emit(event, payload);
};
