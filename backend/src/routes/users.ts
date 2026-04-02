import express, { Router } from 'express';
import { getDatabase } from '../database/connection.js';
import type { AuthRequest } from '../auth/routes.js';

const router = Router();

/**
 * Get user profile
 */
router.get('/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();
    const result = await db.query(
      `SELECT id, apple_id, display_name, rating, wins, losses, draws, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const totalGames = user.wins + user.losses + user.draws;
    const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

    res.json({
      id: user.id,
      appleId: user.apple_id,
      displayName: user.display_name || 'Player',
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      totalGames,
      winRate,
      memberSince: user.created_at,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Get user stats
 */
router.get('/:userId/stats', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const db = getDatabase();
    const result = await db.query(
      `SELECT rating, wins, losses, draws FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const totalGames = user.wins + user.losses + user.draws;

    res.json({
      userId,
      rating: user.rating,
      gamesPlayed: totalGames,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      winRate: totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Get user game history
 */
router.get('/me/history', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDatabase();
    const result = await db.query(
      `SELECT id, mode, result, difficulty, created_at, completed_at, pgn
       FROM games 
       WHERE white_player_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 50`,
      [req.userId]
    );

    const games = result.rows.map(game => ({
      id: game.id,
      mode: game.mode,
      result: game.result,
      difficulty: game.difficulty,
      date: game.completed_at,
      duration: game.completed_at ? 
        Math.round((new Date(game.completed_at).getTime() - new Date(game.created_at).getTime()) / 1000) : 0,
      pgn: game.pgn,
    }));

    res.json({ success: true, games });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

export default router;
