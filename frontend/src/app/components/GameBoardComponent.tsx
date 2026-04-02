import React, { useState } from 'react';
import { CustomChessboard } from './CustomChessboard';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useGame } from '../../hooks/useGame';

export function GameBoard() {
  const { gameId, gameState, handleMove, handleResign, startNewGame, setDifficulty } = useGame();
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(3);

  const handlePieceDrop = (from: string, to: string): boolean => {
    handleMove({ from, to }).catch(console.error);
    return true;
  };

  const handleDifficultyChange = (level: number) => {
    setSelectedDifficulty(level);
    setDifficulty(level);
  };

  const handleStartGame = async () => {
    await startNewGame(selectedDifficulty);
  };

  if (!gameId || !gameState) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card className="bg-slate-800/50 border-slate-700 p-8">
          <h2 className="text-xl font-light text-white mb-6">New Game vs AI</h2>

          <div className="mb-6">
            <label className="block text-sm text-slate-300 mb-3">Difficulty Level</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <Button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  variant={selectedDifficulty === level ? 'default' : 'outline'}
                  className="flex-1"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={handleStartGame} className="w-full">
            Start Game
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chessboard */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <CustomChessboard position={gameState.fen} onPieceDrop={handlePieceDrop} />
          </Card>
        </div>

        {/* Game Info */}
        <div className="lg:col-span-1">
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm text-white capitalize">{gameState.status}</p>
              </div>

              {gameState.isCheck && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                  <p className="text-sm text-yellow-200">⚠ Check!</p>
                </div>
              )}

              {gameState.isCheckmate && (
                <div className="p-3 bg-red-900/20 border border-red-700/30 rounded">
                  <p className="text-sm text-red-200">Checkmate!</p>
                </div>
              )}

              <Button onClick={handleResign} variant="destructive" className="w-full">
                Resign
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
