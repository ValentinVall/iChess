import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { gameManager } from '../games/manager.js';
import { createJWTService } from '../auth/jwt.js';
import { getDatabase } from '../database/connection.js';
import { createPersistedOnlineGame, finalizeOnlineGame, type TimeControlConfig } from '../games/persistence.js';
import { getOnlineRatingMode } from '../games/modes.js';

const authService = createJWTService();

interface MatchmakingEntry {
  userId: string;
  socketId: string;
  username: string;
  rating: number;
  queueId: string;
  joinedAt: number;
}

interface MatchmakingPayload {
  queueId?: string;
}

interface MatchMovePayload {
  gameId: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
}

interface RematchResponsePayload {
  gameId: string;
  accept: boolean;
}

interface DrawResponsePayload {
  gameId: string;
  accept: boolean;
}

interface RematchOffer {
  gameId: string;
  requesterId: string;
  opponentId: string;
  createdAt: number;
}

interface GameOverRatingChanges {
  white: { before: number; after: number; delta: number };
  black: { before: number; after: number; delta: number };
}

export class WebSocketManager {
  private io: SocketIOServer;
  private matchmakingQueues: Map<string, MatchmakingEntry[]> = new Map();
  private activeGamesByUser: Map<string, string> = new Map();
  private rematchOffers: Map<string, RematchOffer> = new Map();
  private clockTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
    });

    this.io.use((socket, next) => {
      try {
        const token = this.getSocketToken(socket);

        if (!token) {
          return next(new Error('Missing socket auth token'));
        }

        const decoded = authService.verifyJWT(token);
        socket.data.userId = decoded.userId;
        socket.data.authSubject = decoded.authSubject;

        next();
      } catch (error) {
        next(new Error('Unauthorized socket connection'));
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id, 'user:', socket.data.userId);

      socket.on('resume_active_game', async () => {
        await this.handleResumeActiveGame(socket);
      });

      socket.on('join_game', (gameId: string) => {
        this.handleJoinGame(socket, gameId);
      });

      socket.on('find_match', async (payload?: MatchmakingPayload) => {
        await this.handleFindMatch(socket, payload);
      });

      socket.on('cancel_match', () => {
        this.handleCancelMatch(socket);
      });

      socket.on('request_rematch', async (gameId: string) => {
        await this.handleRequestRematch(socket, gameId);
      });

      socket.on('respond_rematch', async (payload: RematchResponsePayload) => {
        await this.handleRespondRematch(socket, payload);
      });

      socket.on('make_move', async (data: MatchMovePayload) => {
        await this.handleMakeMove(socket, data);
      });

      socket.on('move', async (data: MatchMovePayload) => {
        await this.handleMakeMove(socket, data);
      });

      socket.on('resign', async (gameId: string) => {
        const result = gameManager.resignGame(gameId, socket.data.userId);

        if (result.success) {
          await this.finalizeAndBroadcastGame(gameId, 'resign');
        }
      });

      socket.on('draw_offer', (gameId: string) => {
        this.handleDrawOffer(socket, gameId);
      });

      socket.on('draw_accept', (gameId: string) => {
        this.handleDrawResponse(socket, { gameId, accept: true });
      });

      socket.on('draw_response', (payload: DrawResponsePayload) => {
        this.handleDrawResponse(socket, payload);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinGame(socket: Socket, gameId: string) {
    const userId = String(socket.data.userId ?? '');
    if (!userId || !gameManager.isPlayerInGame(gameId, userId)) {
      socket.emit('matchmaking_error', { error: 'Game access denied' });
      return;
    }

    socket.join(this.getGameRoom(gameId));
    socket.data.gameId = gameId;
  }

  private async handleFindMatch(socket: Socket, payload?: MatchmakingPayload) {
    const userId = String(socket.data.userId ?? '');
    if (!userId) {
      socket.emit('matchmaking_error', { error: 'Unauthorized socket connection' });
      return;
    }

    const activeGameId = this.activeGamesByUser.get(userId);
    if (activeGameId) {
      await this.restoreActiveGame(socket, activeGameId);
      return;
    }

    const queueId = this.normalizeQueueId(payload?.queueId);
    this.removeUserFromQueues(userId);

    const userSummary = await this.getUserSummary(userId, queueId);
    const queue = this.matchmakingQueues.get(queueId) ?? [];
    const entry: MatchmakingEntry = {
      userId,
      socketId: socket.id,
      username: userSummary.username,
      rating: userSummary.rating,
      queueId,
      joinedAt: Date.now(),
    };

    queue.push(entry);
    this.matchmakingQueues.set(queueId, queue);
    socket.data.queueId = queueId;
    socket.emit('queue_status', { status: 'searching', queueId });

    await this.tryMatch(queueId);
  }

  private async handleResumeActiveGame(socket: Socket) {
    const userId = String(socket.data.userId ?? '');
    if (!userId) {
      socket.emit('matchmaking_error', { error: 'Unauthorized socket connection' });
      return;
    }

    const activeGameId = this.activeGamesByUser.get(userId);
    if (!activeGameId) {
      socket.emit('queue_status', {
        status: 'idle',
        queueId: this.normalizeQueueId(),
      });
      return;
    }

    await this.restoreActiveGame(socket, activeGameId);
  }

  private handleCancelMatch(socket: Socket) {
    const userId = String(socket.data.userId ?? '');
    const queueId = typeof socket.data.queueId === 'string' ? socket.data.queueId : undefined;
    const removed = this.removeUserFromQueues(userId);

    socket.data.queueId = undefined;

    if (removed || queueId) {
      socket.emit('queue_status', {
        status: 'idle',
        queueId: queueId ?? this.normalizeQueueId(),
      });
    }
  }

  private async handleRequestRematch(socket: Socket, gameId: string) {
    const userId = String(socket.data.userId ?? '');
    const gameData = gameManager.getGame(gameId);

    if (!userId || !gameData) {
      socket.emit('matchmaking_error', { error: 'Game not found for rematch' });
      return;
    }

    if (!gameManager.isPlayerInGame(gameId, userId)) {
      socket.emit('matchmaking_error', { error: 'Game access denied' });
      return;
    }

    if (gameData.metadata.status !== 'completed') {
      socket.emit('matchmaking_error', { error: 'Rematch is only available after the game ends' });
      return;
    }

    const opponentId = gameData.metadata.whitePlayerId === userId
      ? gameData.metadata.blackPlayerId
      : gameData.metadata.whitePlayerId;

    if (!opponentId) {
      socket.emit('matchmaking_error', { error: 'Opponent is unavailable for rematch' });
      return;
    }

    const existingOffer = this.rematchOffers.get(gameId);
    if (existingOffer) {
      if (existingOffer.requesterId === userId) {
        socket.emit('rematch_request_status', { gameId, status: 'pending' });
        return;
      }

      socket.emit('matchmaking_error', { error: 'A rematch offer is already pending for this game' });
      return;
    }

    const requester = await this.getUserSummary(userId);
    this.rematchOffers.set(gameId, {
      gameId,
      requesterId: userId,
      opponentId,
      createdAt: Date.now(),
    });

    socket.emit('rematch_request_status', { gameId, status: 'pending' });
    this.emitToUser(opponentId, 'rematch_requested', {
      gameId,
      requestedBy: {
        id: requester.id,
        username: requester.username,
      },
    });
  }

  private async handleRespondRematch(socket: Socket, payload: RematchResponsePayload) {
    const userId = String(socket.data.userId ?? '');
    const offer = this.rematchOffers.get(payload.gameId);

    if (!userId || !offer) {
      socket.emit('matchmaking_error', { error: 'No pending rematch offer found' });
      return;
    }

    if (offer.opponentId !== userId) {
      socket.emit('matchmaking_error', { error: 'You cannot respond to this rematch offer' });
      return;
    }

    this.rematchOffers.delete(payload.gameId);

    if (!payload.accept) {
      this.emitToUser(offer.requesterId, 'rematch_response', {
        gameId: payload.gameId,
        status: 'declined',
      });
      return;
    }

    await this.startDirectRematch(payload.gameId, offer.requesterId, offer.opponentId);
  }

  private handleDrawOffer(socket: Socket, gameId: string) {
    const userId = String(socket.data.userId ?? '');
    const gameData = gameManager.getGame(gameId);

    if (!userId || !gameData) {
      socket.emit('matchmaking_error', { error: 'Game not found for draw offer' });
      return;
    }

    if (!gameManager.isPlayerInGame(gameId, userId)) {
      socket.emit('matchmaking_error', { error: 'Game access denied' });
      return;
    }

    if (gameData.metadata.status !== 'active') {
      socket.emit('matchmaking_error', { error: 'Draw can only be offered in an active game' });
      return;
    }

    const opponentId = gameData.metadata.whitePlayerId === userId
      ? gameData.metadata.blackPlayerId
      : gameData.metadata.whitePlayerId;

    if (!opponentId) {
      socket.emit('matchmaking_error', { error: 'Opponent is unavailable for draw offer' });
      return;
    }

    socket.emit('draw_offer_status', { gameId, status: 'pending' });
    this.emitToUser(opponentId, 'draw_offered', {
      gameId,
      offeredBy: userId,
    });
  }

  private handleDrawResponse(socket: Socket, payload: DrawResponsePayload) {
    const userId = String(socket.data.userId ?? '');
    const gameData = gameManager.getGame(payload.gameId);

    if (!userId || !gameData) {
      socket.emit('matchmaking_error', { error: 'Game not found for draw response' });
      return;
    }

    if (!gameManager.isPlayerInGame(payload.gameId, userId)) {
      socket.emit('matchmaking_error', { error: 'Game access denied' });
      return;
    }

    const opponentId = gameData.metadata.whitePlayerId === userId
      ? gameData.metadata.blackPlayerId
      : gameData.metadata.whitePlayerId;

    if (!opponentId) {
      socket.emit('matchmaking_error', { error: 'Opponent is unavailable for draw response' });
      return;
    }

    if (!payload.accept) {
      this.emitToUser(opponentId, 'draw_offer_status', {
        gameId: payload.gameId,
        status: 'declined',
      });
      return;
    }

    const gameDataRef = gameManager.getGame(payload.gameId);
    if (gameDataRef) {
      gameDataRef.metadata.status = 'completed';
      gameDataRef.metadata.result = 'draw';
      gameDataRef.metadata.completedAt = new Date();
      gameDataRef.metadata.updatedAt = new Date();
    }

    void this.finalizeAndBroadcastGame(payload.gameId, 'draw');
  }

  private async handleMakeMove(socket: Socket, data: MatchMovePayload) {
    const userId = String(socket.data.userId ?? '');
    const { gameId, move } = data;
    const result = gameManager.makePlayerMove(gameId, userId, move);

    if (!result.success) {
      socket.emit('move_error', { error: result.error });
      return;
    }

    const payload = result.result as {
      move: { from: string; to: string; san: string };
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
      clock?: {
        initialTimeMs: number;
        incrementMs: number;
        whiteTimeMs: number;
        blackTimeMs: number;
        activeColor: 'white' | 'black';
        lastUpdatedAt: number;
        isRunning: boolean;
      };
      gameStatus: 'active' | 'completed';
    };

    this.scheduleClockExpiration(gameId);

    this.io.to(this.getGameRoom(gameId)).emit('move_made', {
      gameId,
      move: payload.move,
      state: {
        fen: payload.fen,
        pgn: payload.pgn,
        turn: payload.turn,
        isCheck: payload.isCheck,
        isCheckmate: payload.isCheckmate,
        isDraw: payload.isDraw,
        result: payload.result,
        moveHistory: payload.moveHistory,
        moves: payload.moves,
        legalMoves: payload.legalMoves,
        clock: payload.clock,
      },
    });

    if (payload.gameStatus === 'completed') {
      await this.finalizeAndBroadcastGame(gameId, payload.isCheckmate ? 'checkmate' : 'draw');
    }
  }

  private async tryMatch(queueId: string) {
    const queue = this.matchmakingQueues.get(queueId);
    if (!queue || queue.length < 2) {
      return;
    }

    while (queue.length >= 2) {
      const whiteEntry = queue.shift();
      const blackEntry = queue.shift();

      if (!whiteEntry || !blackEntry) {
        break;
      }

      const whiteSocket = this.io.sockets.sockets.get(whiteEntry.socketId);
      const blackSocket = this.io.sockets.sockets.get(blackEntry.socketId);

      if (!whiteSocket || !blackSocket) {
        continue;
      }

      const timeControl = this.resolveTimeControl(queueId);
      const persistedGame = await createPersistedOnlineGame(whiteEntry.userId, blackEntry.userId, timeControl);
      const game = gameManager.createGame(whiteEntry.userId, 'online', blackEntry.userId, {
        gameId: persistedGame.id,
        timeControlId: timeControl.id,
        initialTimeMs: timeControl.initialTimeMs,
        incrementMs: timeControl.incrementMs,
      });
      const roomName = this.getGameRoom(game.id);
      const gameState = gameManager.getGameState(game.id)?.state;

      if (!gameState) {
        continue;
      }

      whiteSocket.join(roomName);
      blackSocket.join(roomName);

      whiteSocket.data.gameId = game.id;
      blackSocket.data.gameId = game.id;
      whiteSocket.data.queueId = undefined;
      blackSocket.data.queueId = undefined;

      this.activeGamesByUser.set(whiteEntry.userId, game.id);
      this.activeGamesByUser.set(blackEntry.userId, game.id);
      this.scheduleClockExpiration(game.id);

      whiteSocket.emit('queue_status', { status: 'matched', queueId });
      blackSocket.emit('queue_status', { status: 'matched', queueId });

      await this.emitMatchFound(whiteSocket, game.id);
      await this.emitMatchFound(blackSocket, game.id);
    }

    if (queue.length === 0) {
      this.matchmakingQueues.delete(queueId);
    }
  }

  private removeUserFromQueues(userId: string) {
    let removed = false;

    for (const [queueId, queue] of this.matchmakingQueues.entries()) {
      const filteredQueue = queue.filter((entry) => entry.userId !== userId);
      if (filteredQueue.length !== queue.length) {
        removed = true;
      }

      if (filteredQueue.length > 0) {
        this.matchmakingQueues.set(queueId, filteredQueue);
      } else {
        this.matchmakingQueues.delete(queueId);
      }
    }

    return removed;
  }

  private clearActiveGame(gameId: string) {
    const gameData = gameManager.getGame(gameId);
    if (!gameData) {
      return;
    }

    this.cancelClockExpiration(gameId);
    this.activeGamesByUser.delete(gameData.metadata.whitePlayerId);
    if (gameData.metadata.blackPlayerId) {
      this.activeGamesByUser.delete(gameData.metadata.blackPlayerId);
    }
  }

  private async getUserSummary(userId: string, queueId?: string) {
    const db = getDatabase();
    const ratingMode = getOnlineRatingMode(queueId);
    const result = await db.query(
      `SELECT users.id, users.player_number, users.username, user_mode_stats.rating
       FROM users
       LEFT JOIN user_mode_stats
         ON user_mode_stats.user_id = users.id
        AND user_mode_stats.mode = $2
       WHERE id = $1
       LIMIT 1`,
      [userId, ratingMode]
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error(`User ${userId} not found for matchmaking`);
    }

    return {
      id: String(user.id),
      playerNumber: user.player_number ? `#${user.player_number}` : '--',
      username: user.username || `player-${user.id}`,
      rating: Number(user.rating) || 800,
    };
  }

  private normalizeQueueId(queueId?: string) {
    if (typeof queueId === 'string' && queueId.trim()) {
      return queueId.trim();
    }

    return 'rapid-10-0';
  }

  private getGameRoom(gameId: string) {
    return `game:${gameId}`;
  }

  private handleDisconnect(socket: Socket) {
    console.log('User disconnected:', socket.id);

    const userId = String(socket.data.userId ?? '');
    this.removeUserFromQueues(userId);

    const gameId = typeof socket.data.gameId === 'string' ? socket.data.gameId : undefined;
    if (gameId) {
      this.io.to(this.getGameRoom(gameId)).emit('user_left', {
        userId,
      });
    }
  }

  private async startDirectRematch(previousGameId: string, requesterId: string, opponentId: string) {
    const previousGame = gameManager.getGame(previousGameId);
    if (!previousGame?.metadata.blackPlayerId) {
      this.emitToUser(requesterId, 'matchmaking_error', { error: 'Previous game is unavailable for rematch' });
      this.emitToUser(opponentId, 'matchmaking_error', { error: 'Previous game is unavailable for rematch' });
      return;
    }

    const nextWhitePlayerId = previousGame.metadata.blackPlayerId;
    const nextBlackPlayerId = previousGame.metadata.whitePlayerId;
    const nextTimeControl = this.resolveTimeControl(previousGame.metadata.timeControlId);
    const persistedGame = await createPersistedOnlineGame(nextWhitePlayerId, nextBlackPlayerId, nextTimeControl);
    const nextGame = gameManager.createGame(nextWhitePlayerId, 'online', nextBlackPlayerId, {
      gameId: persistedGame.id,
      timeControlId: nextTimeControl.id,
      initialTimeMs: nextTimeControl.initialTimeMs,
      incrementMs: nextTimeControl.incrementMs,
    });

    this.removeUserFromQueues(requesterId);
    this.removeUserFromQueues(opponentId);
    this.activeGamesByUser.set(nextWhitePlayerId, nextGame.id);
    this.activeGamesByUser.set(nextBlackPlayerId, nextGame.id);
    this.scheduleClockExpiration(nextGame.id);

    await this.emitMatchFoundToUser(nextWhitePlayerId, nextGame.id, previousGameId);
    await this.emitMatchFoundToUser(nextBlackPlayerId, nextGame.id, previousGameId);
  }

  private async restoreActiveGame(socket: Socket, gameId: string) {
    const gameData = gameManager.getGame(gameId);
    if (!gameData || gameData.metadata.status !== 'active') {
      this.clearActiveGame(gameId);
      socket.emit('queue_status', {
        status: 'idle',
        queueId: this.normalizeQueueId(),
      });
      return;
    }

    socket.join(this.getGameRoom(gameId));
    socket.data.gameId = gameId;
    socket.data.queueId = undefined;
    socket.emit('queue_status', {
      status: 'matched',
      queueId: this.normalizeQueueId(),
    });
    this.scheduleClockExpiration(gameId);
    await this.emitMatchFound(socket, gameId);
  }

  private async emitMatchFoundToUser(userId: string, gameId: string, previousGameId?: string) {
    const sockets = this.getSocketsForUser(userId);

    for (const socket of sockets) {
      if (previousGameId) {
        socket.leave(this.getGameRoom(previousGameId));
      }

      socket.join(this.getGameRoom(gameId));
      socket.data.gameId = gameId;
      socket.data.queueId = undefined;
      socket.emit('queue_status', {
        status: 'matched',
        queueId: this.normalizeQueueId(),
      });
      await this.emitMatchFound(socket, gameId);
    }
  }

  private async emitMatchFound(socket: Socket, gameId: string) {
    const userId = String(socket.data.userId ?? '');
    const gameData = gameManager.getGame(gameId);
    const gameState = gameManager.getGameState(gameId)?.state;

    if (!userId || !gameData || !gameState) {
      socket.emit('matchmaking_error', { error: 'Failed to restore active game' });
      return;
    }

    const playerColor = gameData.metadata.whitePlayerId === userId ? 'white' : 'black';
    const opponentId = playerColor === 'white'
      ? gameData.metadata.blackPlayerId
      : gameData.metadata.whitePlayerId;

    if (!opponentId) {
      socket.emit('matchmaking_error', { error: 'Failed to resolve opponent for active game' });
      return;
    }

    const opponent = await this.getUserSummary(opponentId, gameData.metadata.timeControlId);

    socket.emit('match_found', {
      gameId,
      color: playerColor,
      opponent: {
        id: opponent.id,
        playerNumber: opponent.playerNumber,
        username: opponent.username,
        rating: opponent.rating,
      },
      state: gameState,
    });
  }

  private emitToUser(userId: string, event: string, data: unknown) {
    for (const socket of this.getSocketsForUser(userId)) {
      socket.emit(event, data);
    }
  }

  private resolveTimeControl(queueId?: string): TimeControlConfig {
    const normalizedQueueId = this.normalizeQueueId(queueId);
    const match = normalizedQueueId.match(/^(bullet|blitz|rapid)-(\d+)-(\d+)$/);

    if (!match) {
      return {
        id: 'rapid-10-0',
        initialTimeMs: 10 * 60 * 1000,
        incrementMs: 0,
      };
    }

    const minutes = Math.max(1, Number(match[2]) || 10);
    const incrementSeconds = Math.max(0, Number(match[3]) || 0);

    return {
      id: normalizedQueueId,
      initialTimeMs: minutes * 60 * 1000,
      incrementMs: incrementSeconds * 1000,
    };
  }

  private scheduleClockExpiration(gameId: string) {
    this.cancelClockExpiration(gameId);

    const remainingTimeMs = gameManager.getRemainingTimeUntilFlag(gameId);
    if (remainingTimeMs === null) {
      return;
    }

    const timeout = setTimeout(() => {
      void this.handleClockExpired(gameId);
    }, Math.max(remainingTimeMs, 0) + 50);

    this.clockTimeouts.set(gameId, timeout);
  }

  private cancelClockExpiration(gameId: string) {
    const timeout = this.clockTimeouts.get(gameId);
    if (!timeout) {
      return;
    }

    clearTimeout(timeout);
    this.clockTimeouts.delete(gameId);
  }

  private async handleClockExpired(gameId: string) {
    this.clockTimeouts.delete(gameId);

    const result = gameManager.expireClock(gameId);
    if (!result.success) {
      return;
    }

    await this.finalizeAndBroadcastGame(gameId, 'timeout');
  }

  private async finalizeAndBroadcastGame(
    gameId: string,
    reason: 'checkmate' | 'draw' | 'resign' | 'timeout',
  ) {
    const gameData = gameManager.getGame(gameId);
    const gameState = gameManager.getGameState(gameId);

    if (!gameData || !gameState || !gameData.metadata.result) {
      return;
    }

    let ratingChanges: GameOverRatingChanges | undefined;

    try {
      const persisted = await finalizeOnlineGame(
        gameId,
        gameData.metadata.result,
        gameState.state.pgn,
        gameState.state.fen,
        reason,
      );
      ratingChanges = persisted?.ratingChanges;
    } catch (error) {
      console.error('Failed to finalize online game:', error);
    }

    const winner = gameData.metadata.result === 'white'
      ? gameData.metadata.whitePlayerId
      : gameData.metadata.result === 'black'
      ? gameData.metadata.blackPlayerId ?? null
      : null;

    this.rematchOffers.delete(gameId);
    this.clearActiveGame(gameId);
    this.io.to(this.getGameRoom(gameId)).emit('game_over', {
      gameId,
      winner,
      reason,
      state: gameState.state,
      ratingChanges,
    });
  }

  private getSocketsForUser(userId: string) {
    return Array.from(this.io.sockets.sockets.values()).filter(
      (socket) => String(socket.data.userId ?? '') === userId,
    );
  }

  private getSocketToken(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const authorizationHeader = socket.handshake.headers.authorization;
    if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.slice(7).trim();
    }

    return null;
  }

  getIO() {
    return this.io;
  }

  broadcastToGame(gameId: string, event: string, data: any) {
    this.io.to(`game:${gameId}`).emit(event, data);
  }
}

let activeWebSocketManager: WebSocketManager | null = null;

export function createWebSocketManager(httpServer: HTTPServer): WebSocketManager {
  activeWebSocketManager = new WebSocketManager(httpServer);
  return activeWebSocketManager;
}

export function getWebSocketManager() {
  return activeWebSocketManager;
}
