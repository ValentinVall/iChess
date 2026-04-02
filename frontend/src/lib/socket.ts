import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: {
          token,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinGame(gameId: string, userId: string) {
    this.socket?.emit('join_game', gameId, userId);
  }

  leaveGame(gameId: string) {
    this.socket?.emit('leave_game', gameId);
  }

  sendMove(gameId: string, move: { from: string; to: string; promotion?: string }) {
    this.socket?.emit('move', { gameId, move });
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
