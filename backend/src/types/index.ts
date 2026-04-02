// Types and interfaces for iChess backend

export interface User {
  id: string;
  appleId: string;
  email?: string;
  displayName?: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId?: string;
  mode: 'ai' | 'online';
  status: 'pending' | 'active' | 'completed';
  pgn: string;
  fen: string;
  result?: 'white' | 'black' | 'draw';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface GameMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface AIMove {
  bestMove: string;
  evaluation: number;
  depth: number;
}

export interface AppleToken {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email: string;
  email_verified: boolean;
  auth_time: number;
  nonce_supported: boolean;
}

export interface JWTPayload {
  userId: string;
  appleId: string;
  iat: number;
  exp: number;
}

export interface WebSocketMessage {
  type: 'move' | 'chat' | 'resign' | 'draw_offer' | 'game_state';
  gameId: string;
  payload: any;
  timestamp: number;
}

export interface RoomSession {
  gameId: string;
  whiteSocketId: string;
  blackSocketId?: string;
  createdAt: Date;
}
