import type EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const stopEmbeddedPostgres = async (pg: EmbeddedPostgres, databaseDir: string): Promise<void> => {
  if (process.platform !== 'win32') return pg.stop();

  // On Windows the library kills only the main process and leaves workers behind, so use PostgreSQL's own shutdown.
  const pgCtl = path.resolve(__dirname, '../node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
  execFileSync(pgCtl, ['stop', '-D', databaseDir, '-m', 'fast', '-w', '-t', '20'], { stdio: 'pipe' });
};
