import { Router } from 'express';
import { createAI } from '../ai/engine.js';
import type { AuthRequest } from '../auth/routes.js';
import { getDatabase } from '../database/connection.js';
import { gameManager } from './manager.js';

const router = Router();
const aiEngine = createAI();

async function persistCompletedGame(gameId: string, userId: string, result: 'white' | 'black' | 'draw', pgn: string, fen: string) {
  const db = getDatabase();
  const updatedGame = await db.query(
    `UPDATE games
     SET status = $1, result = $2, pgn = $3, fen = $4, completed_at = NOW(), updated_at = NOW()
     WHERE id = $5 AND status <> 'completed'
     RETURNING id`,
    ['completed', result, pgn, fen, gameId]
  );

  if (updatedGame.rows.length === 0) {
    return;
  }

  const gameResult = await db.query(
    `SELECT white_player_id, black_player_id
     FROM games
     WHERE id = $1
     LIMIT 1`,
    [gameId]
  );

  const persistedGame = gameResult.rows[0];
  if (!persistedGame) {
    return;
  }

  const playerResult =
    result === 'draw'
      ? 'draw'
      : persistedGame.white_player_id === Number(userId)
      ? result === 'white'
        ? 'win'
        : 'loss'
      : result === 'black'
      ? 'win'
      : 'loss';

  if (playerResult === 'win') {
    await db.query(
      `UPDATE users SET wins = wins + 1, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    return;
  }

  if (playerResult === 'draw') {
    await db.query(
      `UPDATE users SET draws = draws + 1, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    return;
  }

  await db.query(
    `UPDATE users SET losses = losses + 1, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

router.post('/vs-ai', async (req: AuthRequest, res) => {
  try {
    const { difficulty = 4, playerColor = 'white' } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sanitizedDifficulty = Math.min(Math.max(Number(difficulty) || 4, 1), 15);
    const sanitizedPlayerColor = playerColor === 'black' ? 'black' : 'white';
    const whitePlayerId = sanitizedPlayerColor === 'white' ? Number(userId) : 1;
    const blackPlayerId = sanitizedPlayerColor === 'black' ? Number(userId) : 1;
    const db = getDatabase();
    const dbResult = await db.query(
      `INSERT INTO games (white_player_id, black_player_id, mode, status, difficulty, fen)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, difficulty`,
      [whitePlayerId, blackPlayerId, 'ai', 'active', sanitizedDifficulty, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
    );

    const row = dbResult.rows[0];
    const runtimeGame = gameManager.createGame(String(whitePlayerId), 'ai', String(blackPlayerId), {
      gameId: row.id,
      difficulty: sanitizedDifficulty,
    });

    res.json({
      success: true,
      game: {
        id: runtimeGame.id,
        status: row.status,
        difficulty: sanitizedDifficulty,
        playerColor: sanitizedPlayerColor,
        fen: runtimeGame.fen,
        pgn: runtimeGame.pgn,
      },
      state: gameManager.getGameState(runtimeGame.id)?.state,
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

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

    await persistCompletedGame(gameId, String(userId), result, pgn, finalFen);
    res.json({ success: true });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ error: 'Failed to finish game' });
  }
});

router.get('/:gameId', (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { gameId } = req.params;
    const gameState = gameManager.getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const isParticipant =
      gameState.metadata.whitePlayerId === String(userId) ||
      gameState.metadata.blackPlayerId === String(userId);

    if (!isParticipant) {
      return res.status(403).json({ error: 'Game access denied' });
    }

    res.json(gameState);
  } catch {
    res.status(500).json({ error: 'Failed to get game' });
  }
});

router.post('/:gameId/move', async (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const { move } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const gameData = gameManager.getGame(gameId);
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const playerTurnColor = gameData.metadata.whitePlayerId === String(userId) ? 'w' : 'b';
    if (gameData.game.turn() !== playerTurnColor) {
      return res.status(400).json({ error: 'It is not your turn' });
    }

    const result = gameManager.makeMove(gameId, move);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const payload = result.result as {
      gameStatus: 'active' | 'completed';
      result?: 'white' | 'black' | 'draw';
      pgn: string;
      fen: string;
    };

    if (payload.gameStatus === 'completed' && payload.result) {
      await persistCompletedGame(gameId, String(userId), payload.result, payload.pgn, payload.fen);
    }

    res.json({ success: true, result: result.result });
  } catch {
    res.status(500).json({ error: 'Failed to make move' });
  }
});

router.post('/:gameId/ai-move', async (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const gameData = gameManager.getGame(gameId);
    if (!gameData) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameData.metadata.mode !== 'ai') {
      return res.status(400).json({ error: 'AI move is only available for AI games' });
    }

    if (gameData.metadata.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const aiTurnColor = gameData.metadata.whitePlayerId === String(userId) ? 'b' : 'w';
    if (gameData.game.turn() !== aiTurnColor) {
      return res.status(400).json({ error: 'It is not the AI turn' });
    }

    const aiMove = await aiEngine.getBestMove(gameData.game.fen(), gameData.metadata.difficulty || 4);
    const applied = gameManager.applyUCIMove(gameId, aiMove.bestMove);
    if (!applied.success) {
      return res.status(400).json({ error: applied.error });
    }

    const payload = applied.result as {
      gameStatus: 'active' | 'completed';
      result?: 'white' | 'black' | 'draw';
      pgn: string;
      fen: string;
    };

    if (payload.gameStatus === 'completed' && payload.result) {
      await persistCompletedGame(gameId, String(userId), payload.result, payload.pgn, payload.fen);
    }

    res.json({ success: true, ai: aiMove, result: applied.result });
  } catch (error) {
    console.error('AI move error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate AI move' });
  }
});

router.post('/:gameId/resign', async (req: AuthRequest, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = gameManager.resignGame(gameId, String(userId));
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const gameState = gameManager.getGameState(gameId);
    const gameData = gameManager.getGame(gameId);
    if (gameState && gameData?.metadata.result) {
      await persistCompletedGame(gameId, String(userId), gameData.metadata.result, gameState.state.pgn, gameState.state.fen);
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to resign' });
  }
});

export default router;