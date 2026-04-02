import { create } from 'zustand';
import { apiClient } from '../api/client';

interface GameState {
  fen: string;
  pgn: string;
  moves: any[];
  status: 'pending' | 'active' | 'completed';
  result?: 'white' | 'black' | 'draw';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
}

interface GameStore {
  gameId: string | null;
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  difficulty: number;

  // Actions
  createGameVsAI: (difficulty?: number) => Promise<void>;
  loadGameState: (gameId: string) => Promise<void>;
  makeMove: (move: { from: string; to: string; promotion?: string }) => Promise<void>;
  resignGame: () => Promise<void>;
  setDifficulty: (level: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  gameState: null,
  isLoading: false,
  error: null,
  difficulty: 3,

  createGameVsAI: async (difficulty = 3) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.createGameVsAI(difficulty);
      set({
        gameId: response.data.game.id,
        gameState: {
          fen: response.data.game.fen,
          pgn: response.data.game.pgn,
          moves: [],
          status: response.data.game.status,
          isCheck: false,
          isCheckmate: false,
          isDraw: false,
        },
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create game',
        isLoading: false,
      });
      throw error;
    }
  },

  loadGameState: async (gameId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getGameState(gameId);
      set({
        gameId,
        gameState: response.data.state,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to load game',
        isLoading: false,
      });
    }
  },

  makeMove: async (move: { from: string; to: string; promotion?: string }) => {
    const gameId = get().gameId;
    if (!gameId) {
      set({ error: 'No game loaded' });
      return;
    }

    try {
      const response = await apiClient.makeMove(gameId, move);
      const { result } = response.data;

      set((state) => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              fen: result.fen,
              pgn: result.pgn,
              isCheck: result.isCheck,
              isCheckmate: result.isCheckmate,
              isDraw: result.isDraw,
              status: result.gameStatus,
            }
          : null,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to make move' });
      throw error;
    }
  },

  resignGame: async () => {
    const gameId = get().gameId;
    if (!gameId) {
      set({ error: 'No game loaded' });
      return;
    }

    try {
      await apiClient.resignGame(gameId);
      set((state) => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              status: 'completed',
              result: 'black',
            }
          : null,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to resign' });
    }
  },

  setDifficulty: (level: number) => {
    set({ difficulty: Math.max(1, Math.min(5, level)) });
  },

  resetGame: () => {
    set({
      gameId: null,
      gameState: null,
      error: null,
    });
  },
}));
