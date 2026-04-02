// Database schema for iChess

export const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  apple_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  display_name VARCHAR(255),
  rating INTEGER DEFAULT 1600,
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
  pgn TEXT,
  fen TEXT,
  result VARCHAR(20) CHECK (result IN ('white', 'black', 'draw')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Game moves table (for move history)
CREATE TABLE IF NOT EXISTS game_moves (
  id SERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  from_square VARCHAR(2) NOT NULL,
  to_square VARCHAR(2) NOT NULL,
  promotion VARCHAR(1),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User ratings history
CREATE TABLE IF NOT EXISTS rating_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_id UUID REFERENCES games(id),
  rating_before INTEGER,
  rating_after INTEGER,
  rating_change INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id);
`;
