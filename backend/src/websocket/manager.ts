import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { WebSocketMessage, RoomSession } from '../types/index.js';
import { gameManager } from '../games/manager.js';

export class WebSocketManager {
  private io: SocketIOServer;
  private rooms: Map<string, RoomSession> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id);

      // Join game room
      socket.on('join_game', (gameId: string, userId: string) => {
        socket.join(`game:${gameId}`);
        socket.data.userId = userId;
        socket.data.gameId = gameId;

        // Notify others
        this.io.to(`game:${gameId}`).emit('user_joined', {
          userId,
          socketId: socket.id,
        });
      });

      // Handle moves
      socket.on('move', (data: { gameId: string; move: any }) => {
        const { gameId, move } = data;
        const result = gameManager.makeMove(gameId, move);

        if (result.success) {
          // Broadcast move to all players in room
          this.io.to(`game:${gameId}`).emit('move_made', {
            move: result.result,
            timestamp: Date.now(),
          });
        } else {
          socket.emit('move_error', { error: result.error });
        }
      });

      // Handle resign
      socket.on('resign', (gameId: string) => {
        const result = gameManager.resignGame(gameId, socket.data.userId);

        if (result.success) {
          this.io.to(`game:${gameId}`).emit('game_ended', {
            reason: 'resign',
            winner: socket.data.userId === gameManager.getGame(gameId)?.metadata.whitePlayerId
              ? 'black'
              : 'white',
          });
        }
      });

      // Handle draw offer
      socket.on('draw_offer', (gameId: string) => {
        this.io.to(`game:${gameId}`).emit('draw_offered', {
          offeredBy: socket.data.userId,
        });
      });

      // Handle draw accept
      socket.on('draw_accept', (gameId: string) => {
        this.io.to(`game:${gameId}`).emit('game_ended', {
          reason: 'draw',
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const gameId = socket.data.gameId;

        if (gameId) {
          this.io.to(`game:${gameId}`).emit('user_left', {
            userId: socket.data.userId,
          });
        }
      });
    });
  }

  getIO() {
    return this.io;
  }

  broadcastToGame(gameId: string, event: string, data: any) {
    this.io.to(`game:${gameId}`).emit(event, data);
  }
}

export function createWebSocketManager(httpServer: HTTPServer): WebSocketManager {
  return new WebSocketManager(httpServer);
}
