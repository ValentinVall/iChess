import { getDatabase } from './connection.js';

const ONLINE_MODE_VALUES_SQL = `('bullet'), ('blitz'), ('rapid')`;

const schema = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS player_number_seq START WITH 1;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  player_number INTEGER,
  apple_id VARCHAR(255) UNIQUE NOT NULL,
  apple_sub VARCHAR(255),
  provider VARCHAR(32),
  password_hash TEXT,
  email VARCHAR(255),
  display_name VARCHAR(255),
  username VARCHAR(50),
  bio TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT FALSE,
  rating INTEGER DEFAULT 800,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id INTEGER NOT NULL REFERENCES users(id),
  black_player_id INTEGER REFERENCES users(id),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('ai', 'online')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'completed')),
  difficulty INTEGER DEFAULT 4,
  time_control_id VARCHAR(32),
  initial_time_ms INTEGER,
  increment_ms INTEGER DEFAULT 0,
  pgn TEXT,
  fen TEXT,
  result VARCHAR(20) CHECK (result IN ('white', 'black', 'draw')),
  termination_reason VARCHAR(20),
  white_rating_before INTEGER,
  white_rating_after INTEGER,
  black_rating_before INTEGER,
  black_rating_after INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Game moves table (for move history)
CREATE TABLE IF NOT EXISTS game_moves (
  id SERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  from_square VARCHAR(2),
  to_square VARCHAR(2),
  san VARCHAR(10),
  promotion VARCHAR(1),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS user_mode_stats (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('bullet', 'blitz', 'rapid')),
  rating INTEGER NOT NULL DEFAULT 800,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, mode)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_number INTEGER;
ALTER TABLE users ALTER COLUMN player_number SET DEFAULT nextval('player_number_seq');
ALTER TABLE users ALTER COLUMN rating SET DEFAULT 800;
ALTER TABLE games ADD COLUMN IF NOT EXISTS time_control_id VARCHAR(32);
ALTER TABLE games ADD COLUMN IF NOT EXISTS initial_time_ms INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS increment_ms INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(20);
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_rating_before INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_rating_after INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_rating_before INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_rating_after INTEGER;
UPDATE users SET apple_sub = apple_id WHERE apple_sub IS NULL AND COALESCE(is_system, FALSE) = FALSE;
UPDATE users SET provider = CASE WHEN COALESCE(is_system, FALSE) THEN 'system' ELSE COALESCE(provider, 'local') END WHERE provider IS NULL;
WITH next_numbers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS sequence_number
  FROM users
  WHERE COALESCE(is_system, FALSE) = FALSE
    AND player_number IS NULL
),
existing_numbers AS (
  SELECT COALESCE(MAX(player_number), 0) AS max_player_number
  FROM users
)
UPDATE users
SET player_number = existing_numbers.max_player_number + next_numbers.sequence_number
FROM next_numbers, existing_numbers
WHERE users.id = next_numbers.id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub_unique ON users(apple_sub) WHERE apple_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_player_number_unique ON users(player_number) WHERE player_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_games_mode_status ON games(mode, status);
CREATE INDEX IF NOT EXISTS idx_user_mode_stats_mode ON user_mode_stats(mode);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair_unique ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
`;

const backfillUserModeStatsSql = `
INSERT INTO user_mode_stats (user_id, mode, rating, wins, losses, draws)
SELECT
  users.id,
  modes.mode,
  COALESCE(latest_ratings.rating, CASE WHEN COALESCE(users.is_system, FALSE) THEN 0 ELSE 800 END) AS rating,
  COALESCE(mode_results.wins, 0) AS wins,
  COALESCE(mode_results.losses, 0) AS losses,
  COALESCE(mode_results.draws, 0) AS draws
FROM users
CROSS JOIN (VALUES ${ONLINE_MODE_VALUES_SQL}) AS modes(mode)
LEFT JOIN (
  SELECT
    summary.user_id,
    summary.mode,
    COUNT(*) FILTER (WHERE summary.outcome = 'win') AS wins,
    COUNT(*) FILTER (WHERE summary.outcome = 'loss') AS losses,
    COUNT(*) FILTER (WHERE summary.outcome = 'draw') AS draws
  FROM (
    SELECT
      games.white_player_id AS user_id,
      CASE
        WHEN games.time_control_id LIKE 'bullet-%' THEN 'bullet'
        WHEN games.time_control_id LIKE 'blitz-%' THEN 'blitz'
        ELSE 'rapid'
      END AS mode,
      CASE
        WHEN games.result = 'white' THEN 'win'
        WHEN games.result = 'black' THEN 'loss'
        ELSE 'draw'
      END AS outcome
    FROM games
    WHERE games.mode = 'online'
      AND games.status = 'completed'
      AND games.white_player_id IS NOT NULL

    UNION ALL

    SELECT
      games.black_player_id AS user_id,
      CASE
        WHEN games.time_control_id LIKE 'bullet-%' THEN 'bullet'
        WHEN games.time_control_id LIKE 'blitz-%' THEN 'blitz'
        ELSE 'rapid'
      END AS mode,
      CASE
        WHEN games.result = 'black' THEN 'win'
        WHEN games.result = 'white' THEN 'loss'
        ELSE 'draw'
      END AS outcome
    FROM games
    WHERE games.mode = 'online'
      AND games.status = 'completed'
      AND games.black_player_id IS NOT NULL
  ) AS summary
  GROUP BY summary.user_id, summary.mode
) AS mode_results
  ON mode_results.user_id = users.id
 AND mode_results.mode = modes.mode
LEFT JOIN (
  SELECT DISTINCT ON (ratings.user_id, ratings.mode)
    ratings.user_id,
    ratings.mode,
    ratings.rating
  FROM (
    SELECT
      games.white_player_id AS user_id,
      CASE
        WHEN games.time_control_id LIKE 'bullet-%' THEN 'bullet'
        WHEN games.time_control_id LIKE 'blitz-%' THEN 'blitz'
        ELSE 'rapid'
      END AS mode,
      games.white_rating_after AS rating,
      COALESCE(games.completed_at, games.updated_at, games.created_at) AS activity_at
    FROM games
    WHERE games.mode = 'online'
      AND games.status = 'completed'
      AND games.white_player_id IS NOT NULL
      AND games.white_rating_after IS NOT NULL

    UNION ALL

    SELECT
      games.black_player_id AS user_id,
      CASE
        WHEN games.time_control_id LIKE 'bullet-%' THEN 'bullet'
        WHEN games.time_control_id LIKE 'blitz-%' THEN 'blitz'
        ELSE 'rapid'
      END AS mode,
      games.black_rating_after AS rating,
      COALESCE(games.completed_at, games.updated_at, games.created_at) AS activity_at
    FROM games
    WHERE games.mode = 'online'
      AND games.status = 'completed'
      AND games.black_player_id IS NOT NULL
      AND games.black_rating_after IS NOT NULL
  ) AS ratings
  ORDER BY ratings.user_id, ratings.mode, ratings.activity_at DESC, ratings.rating DESC
) AS latest_ratings
  ON latest_ratings.user_id = users.id
 AND latest_ratings.mode = modes.mode
ON CONFLICT (user_id, mode) DO NOTHING`;

const ensureMissingUserModeStatsSql = `
INSERT INTO user_mode_stats (user_id, mode, rating, wins, losses, draws)
SELECT
  users.id,
  modes.mode,
  CASE WHEN COALESCE(users.is_system, FALSE) THEN 0 ELSE 800 END,
  0,
  0,
  0
FROM users
CROSS JOIN (VALUES ${ONLINE_MODE_VALUES_SQL}) AS modes(mode)
ON CONFLICT (user_id, mode) DO NOTHING`;

export async function initializeSchema() {
  try {
    const db = getDatabase();

    await db.query(schema);

    const modeStatsCountResult = await db.query(`SELECT COUNT(*)::int AS count FROM user_mode_stats`);
    const modeStatsCount = Number(modeStatsCountResult.rows[0]?.count || 0);

    if (modeStatsCount === 0) {
      await db.query(backfillUserModeStatsSql);
    } else {
      await db.query(ensureMissingUserModeStatsSql);
    }

    await db.query(`UPDATE users SET rating = 800 WHERE COALESCE(is_system, FALSE) = FALSE AND rating IN (1600, 200)`);

    await db.query(
      `INSERT INTO users (id, player_number, apple_id, apple_sub, provider, email, display_name, username, bio, is_system, rating, wins, losses, draws)
       VALUES (1, NULL, $1, NULL, 'system', NULL, $2, $3, $4, TRUE, 0, 0, 0, 0)
       ON CONFLICT (id) DO UPDATE
       SET player_number = NULL,
           apple_id = EXCLUDED.apple_id,
           apple_sub = NULL,
           provider = 'system',
           email = NULL,
           display_name = EXCLUDED.display_name,
           username = EXCLUDED.username,
           bio = EXCLUDED.bio,
           is_system = TRUE,
           updated_at = NOW()`,
      [
        'system-ichess',
        'Stockfish',
        'stockfish',
        'Reserved system account for the built-in chess engine.',
      ]
    );

    await db.query(
      `INSERT INTO user_mode_stats (user_id, mode, rating, wins, losses, draws)
       VALUES
         (1, 'bullet', 0, 0, 0, 0),
         (1, 'blitz', 0, 0, 0, 0),
         (1, 'rapid', 0, 0, 0, 0)
       ON CONFLICT (user_id, mode) DO UPDATE
       SET rating = EXCLUDED.rating,
           wins = EXCLUDED.wins,
           losses = EXCLUDED.losses,
           draws = EXCLUDED.draws,
           updated_at = NOW()`
    );

    await db.query(
      `SELECT setval(
        'player_number_seq',
        COALESCE((SELECT MAX(player_number) FROM users), 0) + 1,
        FALSE
      )`
    );

    await db.query(
      `SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 1)
      )`
    );

    await db.query(`DROP VIEW IF EXISTS player_account_registry`);

    await db.query(
      `CREATE VIEW player_account_registry AS
       SELECT
         id AS account_id,
         player_number,
         CASE
           WHEN player_number IS NOT NULL THEN CONCAT('#', player_number)
           ELSE NULL
         END AS public_player_number,
         username,
         apple_id,
         apple_sub,
         provider,
         is_system,
         CASE
           WHEN provider = 'system' THEN 'system-account'
           WHEN provider = 'local' THEN 'password-account'
           ELSE 'legacy-account'
         END AS apple_link_status,
         created_at
       FROM users
       ORDER BY id ASC`
    );
    
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Schema initialization error:', error);
    throw error;
  }
}
