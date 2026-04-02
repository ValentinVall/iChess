import type { AIMove } from '../types/index.js';

/**
 * Simple AI engine wrapper
 * In production, integrate with Stockfish engine
 */
export class ChessAI {
  private difficulty: number; // 1-5, where 1 is easiest

  constructor(difficulty: number = 3) {
    this.difficulty = Math.max(1, Math.min(5, difficulty));
  }

  /**
   * Get best move given a FEN position
   */
  async getBestMove(fen: string): Promise<AIMove> {
    // TODO: Integrate with Stockfish engine via:
    // - stockfish.js (WASM)
    // - Child process running native Stockfish binary
    // - External API

    // Placeholder implementation
    return {
      bestMove: 'e2e4',
      evaluation: 0.5,
      depth: this.difficulty * 5,
    };
  }

  /**
   * Get multiple moves ranked by strength
   */
  async getTopMoves(fen: string, count: number = 5): Promise<AIMove[]> {
    // Placeholder
    return [
      {
        bestMove: 'e2e4',
        evaluation: 0.5,
        depth: this.difficulty * 5,
      },
    ];
  }

  setDifficulty(level: number) {
    this.difficulty = Math.max(1, Math.min(5, level));
  }
}

export function createAI(difficulty: number = 3): ChessAI {
  return new ChessAI(difficulty);
}
