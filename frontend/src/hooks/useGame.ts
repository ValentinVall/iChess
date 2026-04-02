import { useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';

export function useGame() {
  const {
    gameId,
    gameState,
    isLoading,
    error,
    createGameVsAI,
    makeMove,
    resignGame,
    resetGame,
    setDifficulty,
  } = useGameStore();

  const { user } = useAuthStore();

  const startNewGame = useCallback(
    async (difficulty: number = 3) => {
      try {
        await createGameVsAI(difficulty);
      } catch (err) {
        console.error('Failed to start game:', err);
      }
    },
    [createGameVsAI]
  );

  const handleMove = useCallback(
    async (move: { from: string; to: string; promotion?: string }) => {
      try {
        await makeMove(move);
      } catch (err) {
        console.error('Move failed:', err);
      }
    },
    [makeMove]
  );

  const handleResign = useCallback(async () => {
    try {
      await resignGame();
    } catch (err) {
      console.error('Resign failed:', err);
    }
  }, [resignGame]);

  return {
    gameId,
    gameState,
    isLoading,
    error,
    startNewGame,
    handleMove,
    handleResign,
    resetGame,
    setDifficulty,
  };
}
