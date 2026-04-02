import { getDatabase } from './connection.js';

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  apple_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  display_name VARCHAR(255),
  rating INTEGER DEFAULT 1600,
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
  difficulty INTEGER DEFAULT 3,
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
  from_square VARCHAR(2),
  to_square VARCHAR(2),
  san VARCHAR(10),
  promotion VARCHAR(1),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

export async function initializeSchema() {
  try {
    const db = getDatabase();
    
    // Split schema by statements and execute
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      await db.query(statement);
    }
    
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Schema initialization error:', error);
    throw error;
  }
}
