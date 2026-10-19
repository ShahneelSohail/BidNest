import { io, type Socket } from 'socket.io-client';
import { api } from './api';

let socket: Socket | null = null;

export const getSocket = async (): Promise<Socket> => {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const token = await api.get<{ token: string }>('/auth/socket-token').then(result => result.token).catch(() => null);
  socket = io(url, { transports: ['websocket'], auth: token ? { token } : {} });
  return socket;
};

export const closeSocket = (): void => {
  socket?.close();
  socket = null;
};
