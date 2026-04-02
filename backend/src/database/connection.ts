import { Pool } from 'pg';

let pool: Pool | null = null;

export function initializeDatabase() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return pool;
}

export function getDatabase() {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}
