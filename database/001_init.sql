CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SEQUENCE IF NOT EXISTS player_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    player_number INTEGER,
    apple_id VARCHAR(255) UNIQUE NOT NULL,
    apple_sub VARCHAR(255),
    provider VARCHAR(32),
    email VARCHAR(255),
    display_name VARCHAR(255),
    username VARCHAR(50),
    bio TEXT DEFAULT '',
    is_system BOOLEAN DEFAULT FALSE,
    rating INTEGER DEFAULT 200,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_number INTEGER;
ALTER TABLE users ALTER COLUMN player_number SET DEFAULT nextval('player_number_seq');
ALTER TABLE users ALTER COLUMN rating SET DEFAULT 200;
UPDATE users SET apple_sub = apple_id WHERE apple_sub IS NULL AND COALESCE(is_system, FALSE) = FALSE;
UPDATE users SET provider = CASE WHEN COALESCE(is_system, FALSE) THEN 'system' ELSE 'apple' END WHERE provider IS NULL;
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

UPDATE users SET rating = 200 WHERE COALESCE(is_system, FALSE) = FALSE AND rating = 1600;

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    white_player_id INTEGER NOT NULL REFERENCES users(id),
    black_player_id INTEGER REFERENCES users(id),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('ai', 'online')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'completed')),
    difficulty INTEGER DEFAULT 3,
    pgn TEXT,
    fen TEXT,
    result VARCHAR(20) CHECK (result IN ('white', 'black', 'draw')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS rating_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    game_id UUID REFERENCES games(id),
    rating_before INTEGER,
    rating_after INTEGER,
    rating_change INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, player_number, apple_id, apple_sub, provider, email, display_name, username, bio, is_system, rating, wins, losses, draws)
VALUES (1, NULL, 'system-ichess', NULL, 'system', NULL, 'ichess', 'ichess', 'Reserved system account.', TRUE, 0, 0, 0, 0)
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
    updated_at = NOW();

SELECT setval(
    'player_number_seq',
    COALESCE((SELECT MAX(player_number) FROM users), 0) + 1,
    FALSE
);

SELECT setval(
    pg_get_serial_sequence('users', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 1)
);

DROP VIEW IF EXISTS player_account_registry;

CREATE VIEW player_account_registry AS
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
        WHEN provider = 'system' THEN 'not-linked-system-account'
        WHEN apple_sub IS NOT NULL THEN 'apple-linked-account'
        ELSE 'unlinked-account'
    END AS apple_link_status,
    created_at
FROM users
ORDER BY id ASC;

CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
