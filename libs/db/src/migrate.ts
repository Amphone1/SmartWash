/**
 * Schema migration runner (rule: every migration is reviewed by hand).
 *
 * This runner does NOT generate or alter schema — it only applies the
 * hand-written `.sql` files in `infra/db/init/` in filename order, exactly once
 * each, inside a transaction. Applied files are recorded in `schema_migrations`
 * with a checksum so an already-applied file is skipped and a *changed*
 * already-applied file is refused (so nobody edits a shipped migration in place).
 *
 * Usage:  DATABASE_URL=postgres://... ts-node libs/db/src/migrate.ts
 *         (Nx target: `nx run db:migrate`)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ??
  resolve(__dirname, '../../../infra/db/init');

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  checksum    TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function listMigrations(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const files = listMigrations(MIGRATIONS_DIR);
  if (files.length === 0) {
    console.log(`[migrate] no .sql files in ${MIGRATIONS_DIR}`);
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(BOOTSTRAP);

    const { rows } = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

    let appliedCount = 0;
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = sha256(sql);
      const previous = applied.get(file);

      if (previous !== undefined) {
        if (previous !== checksum) {
          throw new Error(
            `[migrate] ${file} already applied but its checksum changed. ` +
              `Migrations are immutable — add a new file instead of editing this one.`,
          );
        }
        console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }

      console.log(`[migrate] applying ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(
      `[migrate] done — ${appliedCount} applied, ${files.length - appliedCount} skipped`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
