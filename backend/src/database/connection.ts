import { Pool } from 'pg';

let pool: Pool | null = null;

export function initializeDatabase() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    pool = new Pool({
      connectionString,
    });

    return pool;
  }

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'postgres'),
    database: process.env.DB_NAME || 'ichess',
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
