// Types and interfaces for iChess backend

export interface User {
  id: string;
  authSubject: string;
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
  difficulty?: number;
  timeControlId?: string;
  initialTimeMs?: number;
  incrementMs?: number;
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

export interface GameClockState {
  initialTimeMs: number;
  incrementMs: number;
  whiteTimeMs: number;
  blackTimeMs: number;
  activeColor: 'white' | 'black';
  lastUpdatedAt: number;
  isRunning: boolean;
}

export interface AIMove {
  bestMove: string;
  evaluation: number;
  depth: number;
  pvRank?: number;
  delayMs?: number;
  skillLevel?: number;
}

export interface JWTPayload {
  userId: string;
  authSubject: string;
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
