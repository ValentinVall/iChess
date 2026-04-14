import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ichess',
  };
}

async function showAccountRegistry() {
  const pool = new Pool(getDatabaseConfig());

  try {
    const result = await pool.query(
      `SELECT account_id, player_number, public_player_number, username, apple_id, apple_sub, provider, is_system, apple_link_status, created_at
       FROM player_account_registry
       ORDER BY account_id ASC`
    );

    console.table(result.rows);
  } catch (error) {
    console.error('Failed to read player account registry:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

showAccountRegistry();