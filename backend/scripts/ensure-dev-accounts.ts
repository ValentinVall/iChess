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

async function ensureDevAccounts() {
  const pool = new Pool(getDatabaseConfig());

  try {
    await pool.query(
      `UPDATE users
       SET display_name = 'Stockfish',
           username = 'stockfish',
           bio = 'Reserved system account for the built-in chess engine.',
           updated_at = NOW()
       WHERE id = 1 AND COALESCE(is_system, FALSE) = TRUE`
    );

    await pool.query(
      `INSERT INTO users (apple_id, apple_sub, provider, email, display_name, username, bio, rating)
       VALUES ($1, $2, 'apple', $3, $4, $5, $6, 200)
       ON CONFLICT (apple_id) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           username = EXCLUDED.username,
           bio = EXCLUDED.bio,
           provider = 'apple',
           updated_at = NOW()`,
      [
        'dev-apple-user-ichess',
        'dev-apple-user-ichess',
        'ichess@ichess.local',
        'ichess',
        'ichess',
        'Secondary dev account for online matchmaking and multiplayer testing.',
      ]
    );

    console.log('✅ Dev accounts ensured');
  } catch (error) {
    console.error('❌ Failed to ensure dev accounts:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void ensureDevAccounts();