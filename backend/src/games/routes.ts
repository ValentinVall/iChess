import express, { Router } from 'express';
import { getDatabase } from '../database/connection.js';
import type { AuthRequest } from '../auth/routes.js';
import { gameManager } from '../games/manager.js';

const router = Router();

/**
 * Create new game vs AI
 */
router.post('/vs-ai', async (req: AuthRequest, res) => {
  try {
    const { difficulty = 3 } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();
    
    // Create game in database
    const result = await db.query(
      `INSERT INTO games (white_player_id, black_player_id, mode, status, difficulty, fen)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status`,
      [userId, userId, 'ai', 'active', difficulty, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
    );

    const gameId = result.rows[0].id;

    res.json({
      success: true,
      gameId,
      status: 'active',
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

/**
 * Finish game and save result
 */
router.post('/:gameId/finish', async (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const { result, pgn, finalFen } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['white', 'black', 'draw'].includes(result)) {
      return res.status(400).json({ error: 'Invalid result' });
    }

    const db = getDatabase();

    // Update game with result
    await db.query(
      `UPDATE games 
       SET status = $1, result = $2, pgn = $3, fen = $4, completed_at = NOW()
       WHERE id = $5`,
      ['completed', result, pgn, finalFen, gameId]
    );

    // Update user stats
    const isWin = (result === 'white' && userId) || false;
    const isDraw = result === 'draw';
    const isLoss = (result === 'black' && userId) || false;

    if (isWin || isDraw || isLoss) {
      if (isWin) {
        await db.query(
          `UPDATE users SET wins = wins + 1, rating = rating + 15, updated_at = NOW()
           WHERE id = $1`,
          [userId]
        );
      } else if (isDraw) {
        await db.query(
          `UPDATE users SET draws = draws + 1, updated_at = NOW()
           WHERE id = $1`,
          [userId]
        );
      } else {
        await db.query(
          `UPDATE users SET losses = losses + 1, rating = GREATEST(rating - 10, 800), updated_at = NOW()
           WHERE id = $1`,
          [userId]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ error: 'Failed to finish game' });
  }
});

/**
 * Get game state
 */
router.get('/:gameId', (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const gameState = gameManager.getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(gameState);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get game' });
  }
});

/**
 * Make move in game
 */
router.post('/:gameId/move', (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const { move } = req.body;

    const result = gameManager.makeMove(gameId, move);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, result: result.result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to make move' });
  }
});

/**
 * Resign from game
 */
router.post('/:gameId/resign', (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    const result = gameManager.resignGame(gameId, userId || '');

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resign' });
  }
});

export default router;
