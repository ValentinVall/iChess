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

async function main() {
  const usernames = process.argv.slice(2).map((value) => value.trim().toLowerCase()).filter(Boolean);

  if (usernames.length === 0) {
    throw new Error('Provide at least one username to delete');
  }

  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, username
       FROM users
       WHERE username = ANY($1::text[])
       ORDER BY id ASC`,
      [usernames],
    );

    const userIds = userResult.rows.map((row) => Number(row.id));

    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM games
         WHERE white_player_id = ANY($1::int[])
            OR black_player_id = ANY($1::int[])`,
        [userIds],
      );

      await client.query(
        `DELETE FROM refresh_tokens
         WHERE user_id = ANY($1::int[])`,
        [userIds],
      );

      await client.query(
        `DELETE FROM users
         WHERE id = ANY($1::int[])`,
        [userIds],
      );
    }

    await client.query(
      `SELECT setval(
        'player_number_seq',
        COALESCE((SELECT MAX(player_number) FROM users), 0) + 1,
        FALSE
      )`,
    );

    await client.query('COMMIT');
    console.table(userResult.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to delete accounts:', error);
  process.exitCode = 1;
});