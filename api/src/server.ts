import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { startAuctionTimer } from './jobs/auctionTimer';
import { prisma } from './lib/prisma';
import { UPLOAD_DIR } from './lib/upload';
import { createSocketServer } from './realtime/socket';

const main = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const httpServer = createServer(createApp());
  const io = createSocketServer(httpServer);
  const stopTimer = startAuctionTimer();

  httpServer.listen(env.PORT, () => {
    console.log(`BidNest API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    stopTimer();
    io.close();
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
