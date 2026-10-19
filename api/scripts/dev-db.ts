import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { stopEmbeddedPostgres } from './pg-stop';

const port = Number(process.env.PGPORT ?? 5432);
const databaseDir = path.resolve(__dirname, '../.pgdata');
const database = 'bidnest';

const main = async () => {
  const pg = new EmbeddedPostgres({ databaseDir, user: 'bidnest', password: 'bidnest', port, persistent: true });
  const isFresh = !existsSync(path.join(databaseDir, 'PG_VERSION'));

  if (isFresh) await pg.initialise();
  await pg.start();
  if (isFresh) await pg.createDatabase(database);

  console.log(`PostgreSQL ready: postgresql://bidnest:bidnest@localhost:${port}/${database}`);
  console.log('Press Ctrl+C to stop.');

  const stop = async () => {
    await stopEmbeddedPostgres(pg, databaseDir);
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
