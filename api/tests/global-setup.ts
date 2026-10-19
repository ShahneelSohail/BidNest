import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { stopEmbeddedPostgres } from '../scripts/pg-stop';

const DATABASE = 'bidnest_test';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });

export default async function setup() {
  const port = await freePort();
  const databaseDir = mkdtempSync(path.join(os.tmpdir(), 'bidnest-test-pg-'));
  const pg = new EmbeddedPostgres({ databaseDir, user: 'test', password: 'test', port, persistent: true, onLog: () => {}, onError: () => {} });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DATABASE);

  process.env.DATABASE_URL = `postgresql://test:test@localhost:${port}/${DATABASE}`;
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });

  return async () => {
    await stopEmbeddedPostgres(pg, databaseDir);
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // Windows can keep the data directory locked for a moment after PostgreSQL stops; the OS temp cleaner removes it.
    }
  };
}
