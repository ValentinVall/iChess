import { Chess } from 'chess.js';
import type { Game, GameClockState, GameMove } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

type StoredGame = {
  game: Chess;
  metadata: Game;
  clock?: {
    initialTimeMs: number;
    incrementMs: number;
    whiteTimeMs: number;
    blackTimeMs: number;
    activeTurn: 'w' | 'b';
    turnStartedAt: number;
  };
};

type SerializedGameState = {
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  result?: 'white' | 'black' | 'draw';
  moveHistory: string[];
  moves: Array<{ from: string; to: string; san: string }>;
  legalMoves: string[];
  clock?: GameClockState;
};

export class GameManager {
  private games: Map<string, StoredGame> = new Map();

  createGame(
    whitePlayerId: string,
    mode: 'ai' | 'online',
    blackPlayerId?: string,
    options?: { gameId?: string; difficulty?: number; timeControlId?: string; initialTimeMs?: number; incrementMs?: number },
  ): Game {
    const gameId = options?.gameId || uuidv4();
    const chess = new Chess();
    const shouldUseClock = mode === 'online' && typeof options?.initialTimeMs === 'number' && options.initialTimeMs > 0;
    const clock = shouldUseClock
      ? {
          initialTimeMs: options!.initialTimeMs!,
          incrementMs: options?.incrementMs ?? 0,
          whiteTimeMs: options!.initialTimeMs!,
          blackTimeMs: options!.initialTimeMs!,
          activeTurn: 'w' as const,
          turnStartedAt: Date.now(),
        }
      : undefined;

    const game: Game = {
      id: gameId,
      whitePlayerId,
      blackPlayerId,
      mode,
      difficulty: options?.difficulty,
      timeControlId: options?.timeControlId,
      initialTimeMs: options?.initialTimeMs,
      incrementMs: options?.incrementMs,
      status: 'active',
      pgn: chess.pgn(),
      fen: chess.fen(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.games.set(gameId, { game: chess, metadata: game, clock });
    return game;
  }

  getGame(gameId: string) {
    return this.games.get(gameId);
  }

  isPlayerInGame(gameId: string, playerId: string) {
    return this.getPlayerColor(gameId, playerId) !== null;
  }

  getPlayerColor(gameId: string, playerId: string): 'white' | 'black' | null {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return null;
    }

    if (gameData.metadata.whitePlayerId === playerId) {
      return 'white';
    }

    if (gameData.metadata.blackPlayerId === playerId) {
      return 'black';
    }

    return null;
  }

  makeMove(gameId: string, move: GameMove): { success: boolean; error?: string; result?: unknown } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false, error: 'Game not found' };
    }

    if (gameData.metadata.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }

    return this.applyMove(gameData, move);
  }

  makePlayerMove(gameId: string, playerId: string, move: GameMove): { success: boolean; error?: string; result?: unknown } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false, error: 'Game not found' };
    }

    if (gameData.metadata.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }

    const playerColor = this.getPlayerColor(gameId, playerId);
    if (!playerColor) {
      return { success: false, error: 'You are not a participant in this game' };
    }

    const expectedTurn = playerColor === 'white' ? 'w' : 'b';
    if (gameData.game.turn() !== expectedTurn) {
      return { success: false, error: 'It is not your turn' };
    }

    if (gameData.clock) {
      const remaining = this.getRemainingTimeMs(gameData.clock, expectedTurn);
      if (remaining <= 0) {
        this.completeOnTimeout(gameData, expectedTurn);
        return { success: false, error: 'Your clock has expired' };
      }
    }

    return this.applyMove(gameData, move);
  }

  private applyMove(gameData: StoredGame, move: GameMove): { success: boolean; error?: string; result?: unknown } {
    const { game, metadata } = gameData;
    const movingTurn = game.turn();
    const moveTimestamp = Date.now();

    try {
      const result = game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
      });

      if (!result) {
        return { success: false, error: 'Invalid move' };
      }

      if (gameData.clock) {
        const remaining = this.getRemainingTimeMs(gameData.clock, movingTurn, moveTimestamp);
        if (movingTurn === 'w') {
          gameData.clock.whiteTimeMs = remaining + gameData.clock.incrementMs;
        } else {
          gameData.clock.blackTimeMs = remaining + gameData.clock.incrementMs;
        }

        gameData.clock.activeTurn = game.turn();
        gameData.clock.turnStartedAt = moveTimestamp;
      }

      this.syncMetadata(gameData);

      const state = this.serializeState(gameData);

      return {
        success: true,
        result: {
          move: result,
          ...state,
          gameStatus: metadata.status,
          result: metadata.result,
        },
      };
    } catch {
      return { success: false, error: 'Move failed' };
    }
  }

  applyUCIMove(gameId: string, uciMove: string): { success: boolean; error?: string; result?: unknown } {
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    return this.makeMove(gameId, { from, to, promotion });
  }

  getGameState(gameId: string) {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return null;
    }

    const { game, metadata } = gameData;
    return {
      metadata,
      state: this.serializeState(gameData),
    };
  }

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
    metadata.updatedAt = new Date();

    if (gameData.clock) {
      this.freezeClock(gameData.clock);
    }

    return { success: true };
  }

  expireClock(gameId: string) {
    const gameData = this.games.get(gameId);
    if (!gameData || gameData.metadata.status !== 'active' || !gameData.clock) {
      return { success: false, error: 'Game is not active' };
    }

    const loserColor = gameData.clock.activeTurn;
    const remaining = this.getRemainingTimeMs(gameData.clock, loserColor);
    if (remaining > 0) {
      return { success: false, error: 'Clock is still active' };
    }

    this.completeOnTimeout(gameData, loserColor);

    return {
      success: true,
      result: {
        ...this.serializeState(gameData),
        gameStatus: gameData.metadata.status,
        result: gameData.metadata.result,
      },
    };
  }

  undoMove(gameId: string): { success: boolean; fen?: string } {
    const gameData = this.games.get(gameId);
    if (!gameData) {
      return { success: false };
    }

    const { game } = gameData;

    if (game.undo()) {
      this.syncMetadata(gameData);
      return { success: true, fen: game.fen() };
    }

    return { success: false };
  }

  private serializeState(gameData: StoredGame): SerializedGameState {
    const { game, metadata } = gameData;

    return {
      fen: game.fen(),
      pgn: game.pgn(),
      turn: game.turn(),
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
      result: metadata.result,
      moveHistory: game.history(),
      moves: game.moves({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        san: move.san,
      })),
      legalMoves: game.moves(),
      clock: gameData.clock
        ? {
            initialTimeMs: gameData.clock.initialTimeMs,
            incrementMs: gameData.clock.incrementMs,
            whiteTimeMs: this.getRemainingTimeMs(gameData.clock, 'w'),
            blackTimeMs: this.getRemainingTimeMs(gameData.clock, 'b'),
            activeColor: gameData.clock.activeTurn === 'w' ? 'white' : 'black',
            lastUpdatedAt: Date.now(),
            isRunning: metadata.status === 'active',
          }
        : undefined,
    };
  }

  private syncMetadata(gameData: StoredGame) {
    const { game, metadata } = gameData;

    metadata.fen = game.fen();
    metadata.pgn = game.pgn();
    metadata.updatedAt = new Date();

    if (game.isCheckmate()) {
      metadata.status = 'completed';
      metadata.result = game.turn() === 'w' ? 'black' : 'white';
      metadata.completedAt = new Date();
      if (gameData.clock) {
        this.freezeClock(gameData.clock);
      }
      return;
    }

    if (game.isDraw()) {
      metadata.status = 'completed';
      metadata.result = 'draw';
      metadata.completedAt = new Date();
      if (gameData.clock) {
        this.freezeClock(gameData.clock);
      }
      return;
    }

    metadata.status = 'active';
    metadata.result = undefined;
    metadata.completedAt = undefined;
  }

  getActiveClock(gameId: string) {
    const gameData = this.games.get(gameId);
    if (!gameData?.clock) {
      return null;
    }

    return this.serializeState(gameData).clock ?? null;
  }

  getRemainingTimeUntilFlag(gameId: string) {
    const gameData = this.games.get(gameId);
    if (!gameData?.clock || gameData.metadata.status !== 'active') {
      return null;
    }

    return this.getRemainingTimeMs(gameData.clock, gameData.clock.activeTurn);
  }

  private getRemainingTimeMs(clock: NonNullable<StoredGame['clock']>, color: 'w' | 'b', now = Date.now()) {
    const baseTime = color === 'w' ? clock.whiteTimeMs : clock.blackTimeMs;

    if (clock.activeTurn !== color) {
      return Math.max(0, baseTime);
    }

    return Math.max(0, baseTime - (now - clock.turnStartedAt));
  }

  private freezeClock(clock: NonNullable<StoredGame['clock']>) {
    clock.whiteTimeMs = this.getRemainingTimeMs(clock, 'w');
    clock.blackTimeMs = this.getRemainingTimeMs(clock, 'b');
    clock.turnStartedAt = Date.now();
  }

  private completeOnTimeout(gameData: StoredGame, loserColor: 'w' | 'b') {
    const { metadata, clock } = gameData;
    if (clock) {
      this.freezeClock(clock);
      if (loserColor === 'w') {
        clock.whiteTimeMs = 0;
      } else {
        clock.blackTimeMs = 0;
      }
    }

    metadata.status = 'completed';
    metadata.result = loserColor === 'w' ? 'black' : 'white';
    metadata.completedAt = new Date();
    metadata.updatedAt = new Date();
  }
}

export const gameManager = new GameManager();