import { Chess } from 'chess.js';
import type { Game, GameMove, AIMove } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private games: Map<string, { game: Chess; metadata: Game }> = new Map();

  /**
   * Create a new game
   */
  createGame(whitePlayerId: string, mode: 'ai' | 'online', blackPlayerId?: string): Game {
    const gameId = uuidv4();
    const chess = new Chess();

    const game: Game = {
      id: gameId,
      whitePlayerId,
      blackPlayerId,
      mode,
      status: 'active',
      pgn: chess.pgn(),
      fen: chess.fen(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.games.set(gameId, { game: chess, metadata: game });
    return game;
  }

  /**
   * Get game by ID
   */
  getGame(gameId: string) {
    return this.games.get(gameId);
  }

  /**
   * Make a move
   */
  makeMove(gameId: string, move: GameMove): { success: boolean; error?: string; result?: any } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false, error: 'Game not found' };
    }

    const { game, metadata } = gameData;

    try {
      const result = game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
      });

      if (!result) {
        return { success: false, error: 'Invalid move' };
      }

      metadata.fen = game.fen();
      metadata.pgn = game.pgn();
      metadata.updatedAt = new Date();

      // Check game status
      if (game.isCheckmate()) {
        metadata.status = 'completed';
        metadata.result = game.turn() === 'w' ? 'black' : 'white';
        metadata.completedAt = new Date();
      } else if (game.isDraw()) {
        metadata.status = 'completed';
        metadata.result = 'draw';
        metadata.completedAt = new Date();
      }

      return {
        success: true,
        result: {
          move: result,
          fen: game.fen(),
          pgn: game.pgn(),
          isCheck: game.isCheck(),
          isCheckmate: game.isCheckmate(),
          isDraw: game.isDraw(),
          gameStatus: metadata.status,
        },
      };
    } catch (error) {
      return { success: false, error: 'Move failed' };
    }
  }

  /**
   * Get game state
   */
  getGameState(gameId: string) {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return null;
    }

    const { game, metadata } = gameData;
    return {
      metadata,
      state: {
        fen: game.fen(),
        pgn: game.pgn(),
        turn: game.turn(),
        isCheck: game.isCheck(),
        isCheckmate: game.isCheckmate(),
        isDraw: game.isDraw(),
        moves: game.moves({ verbose: true }),
        legalMoves: game.moves(),
      },
    };
  }

  /**
   * Resign game
   */
  resignGame(gameId: string, playerId: string): { success: boolean; error?: string } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false, error: 'Game not found' };
    }

    const { metadata } = gameData;

    if (metadata.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }

    metadata.status = 'completed';
    metadata.result = metadata.whitePlayerId === playerId ? 'black' : 'white';
    metadata.completedAt = new Date();

    return { success: true };
  }

  /**
   * Undo move (for analysis, if needed)
   */
  undoMove(gameId: string): { success: boolean; fen?: string } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false };
    }

    const { game, metadata } = gameData;

    if (game.undo()) {
      metadata.fen = game.fen();
      metadata.pgn = game.pgn();
      return { success: true, fen: game.fen() };
    }

    return { success: false };
  }
}

export const gameManager = new GameManager();
