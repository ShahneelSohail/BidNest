import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 54329;
const DATABASE = 'bidnest_test';

export default async function setup() {
  const databaseDir = mkdtempSync(path.join(os.tmpdir(), 'bidnest-test-pg-'));
  const pg = new EmbeddedPostgres({ databaseDir, user: 'test', password: 'test', port: PORT, persistent: true, onLog: () => {}, onError: () => {} });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DATABASE);

  process.env.DATABASE_URL = `postgresql://test:test@localhost:${PORT}/${DATABASE}`;
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });

  return async () => {
    await pg.stop();
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // Windows can keep the data directory locked for a moment after PostgreSQL stops; the OS temp cleaner removes it.
    }
  };
}
