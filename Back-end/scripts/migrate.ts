import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../src/db/pool.js';

async function main() {
  const directory = resolve(process.cwd(), 'migrations');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const filename of files) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (exists.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(directory, filename), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Migração aplicada: ${filename}`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}

main().finally(() => pool.end());
