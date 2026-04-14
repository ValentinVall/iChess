import { io, Socket } from 'socket.io-client';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const SOCKET_URL = env?.VITE_API_URL || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<void> | null = null;
  private consumers = new Set<string>();

  connect(token: string, consumerId: string = 'default'): Promise<void> {
    this.consumers.add(consumerId);

    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.socket?.once('connect', () => {
        console.log('WebSocket connected');
        this.connectionPromise = null;
        resolve();
      });

      this.socket?.once('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.connectionPromise = null;
        reject(error);
      });
    });

    return this.connectionPromise;
  }

  disconnect(consumerId: string = 'default') {
    this.consumers.delete(consumerId);

    if (this.consumers.size > 0) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionPromise = null;
  }

  findMatch(queueId: string = 'rapid-10-0') {
    this.socket?.emit('find_match', { queueId });
  }

  cancelMatch() {
    this.socket?.emit('cancel_match');
  }

  resumeActiveGame() {
    this.socket?.emit('resume_active_game');
  }

  requestRematch(gameId: string) {
    this.socket?.emit('request_rematch', gameId);
  }

  respondToRematch(gameId: string, accept: boolean) {
    this.socket?.emit('respond_rematch', { gameId, accept });
  }

  joinGame(gameId: string) {
    this.socket?.emit('join_game', gameId);
  }

  leaveGame(gameId: string) {
    this.socket?.emit('leave_game', gameId);
  }

  sendMove(gameId: string, move: { from: string; to: string; promotion?: string }) {
    this.socket?.emit('make_move', { gameId, move });
  }

  resign(gameId: string) {
    this.socket?.emit('resign', gameId);
  }

  offerDraw(gameId: string) {
    this.socket?.emit('draw_offer', gameId);
  }

  acceptDraw(gameId: string) {
    this.socket?.emit('draw_accept', gameId);
  }

  respondToDraw(gameId: string, accept: boolean) {
    this.socket?.emit('draw_response', { gameId, accept });
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

export const wsService = new WebSocketService();
