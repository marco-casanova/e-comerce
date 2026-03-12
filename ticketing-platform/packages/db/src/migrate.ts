import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { pool } from './client';

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
    if (existing.rowCount) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  await pool.end();
}

runMigrations().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
