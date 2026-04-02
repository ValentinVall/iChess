-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(128) UNIQUE,
    rating INTEGER DEFAULT 1200,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы партий
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    white_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    black_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    result VARCHAR(8), -- 'white', 'black', 'draw', 'aborted'
    moves TEXT,        -- PGN или FEN последовательность
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска партий по игроку
CREATE INDEX IF NOT EXISTS idx_games_white_id ON games(white_id);
CREATE INDEX IF NOT EXISTS idx_games_black_id ON games(black_id);
