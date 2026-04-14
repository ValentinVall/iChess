import { getDatabase } from '../database/connection.js';
import { calculateOnlineRatingUpdate, type RatedGameResult } from './rating.js';
import { getOnlineRatingMode } from './modes.js';

export interface TimeControlConfig {
  id: string;
  initialTimeMs: number;
  incrementMs: number;
}

export interface FinalizedOnlineGameResult {
  gameId: string;
  ratingChanges: {
    white: { before: number; after: number; delta: number };
    black: { before: number; after: number; delta: number };
  };
}

export async function createPersistedOnlineGame(
  whitePlayerId: string,
  blackPlayerId: string,
  timeControl: TimeControlConfig,
) {
  const db = getDatabase();
  const result = await db.query(
    `INSERT INTO games (
       white_player_id,
       black_player_id,
       mode,
       status,
       fen,
       time_control_id,
       initial_time_ms,
       increment_ms
     )
     VALUES ($1, $2, 'online', 'active', $3, $4, $5, $6)
     RETURNING id`,
    [
      Number(whitePlayerId),
      Number(blackPlayerId),
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      timeControl.id,
      timeControl.initialTimeMs,
      timeControl.incrementMs,
    ],
  );

  return result.rows[0] as { id: string };
}

export async function finalizeOnlineGame(
  gameId: string,
  result: RatedGameResult,
  pgn: string,
  fen: string,
  terminationReason: 'checkmate' | 'draw' | 'resign' | 'timeout',
): Promise<FinalizedOnlineGameResult | null> {
  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const gameUpdate = await client.query(
      `UPDATE games
       SET status = 'completed',
           result = $2,
           pgn = $3,
           fen = $4,
           termination_reason = $5,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND mode = 'online' AND status <> 'completed'
       RETURNING id, white_player_id, black_player_id, time_control_id`,
      [gameId, result, pgn, fen, terminationReason],
    );

    if (gameUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const game = gameUpdate.rows[0] as { id: string; white_player_id: number; black_player_id: number; time_control_id: string | null };
    const ratingMode = getOnlineRatingMode(game.time_control_id);

    await client.query(
      `INSERT INTO user_mode_stats (user_id, mode)
       VALUES
         ($1, $3),
         ($2, $3)
       ON CONFLICT (user_id, mode) DO NOTHING`,
      [game.white_player_id, game.black_player_id, ratingMode],
    );

    const ratings = await client.query(
      `SELECT user_id, rating, wins, losses, draws
       FROM user_mode_stats
       WHERE user_id = ANY($1::int[])
         AND mode = $2
       FOR UPDATE`,
      [[game.white_player_id, game.black_player_id], ratingMode],
    );

    if (ratings.rows.length !== 2) {
      throw new Error(`Unable to load both players for online game ${gameId}`);
    }

    const white = ratings.rows.find((row) => row.user_id === game.white_player_id);
    const black = ratings.rows.find((row) => row.user_id === game.black_player_id);

    if (!white || !black) {
      throw new Error(`Missing player ratings for online game ${gameId}`);
    }

    const ratingChanges = calculateOnlineRatingUpdate(
      {
        userId: white.user_id,
        rating: Number(white.rating),
        wins: Number(white.wins),
        losses: Number(white.losses),
        draws: Number(white.draws),
      },
      {
        userId: black.user_id,
        rating: Number(black.rating),
        wins: Number(black.wins),
        losses: Number(black.losses),
        draws: Number(black.draws),
      },
      result,
    );

    await client.query(
      `UPDATE user_mode_stats
       SET rating = $2,
           wins = wins + $3,
           losses = losses + $4,
           draws = draws + $5,
           updated_at = NOW()
       WHERE user_id = $1
         AND mode = $6`,
      [
        game.white_player_id,
        ratingChanges.white.after,
        result === 'white' ? 1 : 0,
        result === 'black' ? 1 : 0,
        result === 'draw' ? 1 : 0,
        ratingMode,
      ],
    );

    await client.query(
      `UPDATE user_mode_stats
       SET rating = $2,
           wins = wins + $3,
           losses = losses + $4,
           draws = draws + $5,
           updated_at = NOW()
       WHERE user_id = $1
         AND mode = $6`,
      [
        game.black_player_id,
        ratingChanges.black.after,
        result === 'black' ? 1 : 0,
        result === 'white' ? 1 : 0,
        result === 'draw' ? 1 : 0,
        ratingMode,
      ],
    );

    await client.query(
      `UPDATE games
       SET white_rating_before = $2,
           white_rating_after = $3,
           black_rating_before = $4,
           black_rating_after = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [
        gameId,
        ratingChanges.white.before,
        ratingChanges.white.after,
        ratingChanges.black.before,
        ratingChanges.black.after,
      ],
    );

    await client.query('COMMIT');

    return {
      gameId,
      ratingChanges,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}