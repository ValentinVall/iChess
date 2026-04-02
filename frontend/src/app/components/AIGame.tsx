import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { Chess, Square } from "chess.js";
import { CustomChessboard } from "./CustomChessboard";
import { apiClient } from "../../lib/api";
import { ArrowLeft, RotateCcw, Trophy, X, Undo2 } from "lucide-react";

export function AIGame() {
  const navigate = useNavigate();
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState(new Chess());
  const [difficulty, setDifficulty] = useState(3);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"win" | "loss" | "draw" | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);

  // Initialize game
  useEffect(() => {
    const initGame = async () => {
      try {
        const response = await apiClient.createGame(difficulty);
        setGameId(response.gameId);
      } catch (error) {
        console.error('Failed to create game:', error);
        // Continue with offline mode
      }
    };
    initGame();
  }, []);

  // Piece values for evaluation
  const pieceValueMap: Record<string, number> = {
    p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
    P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0
  };

  // Calculate material count (to evaluate position advantage)
  function calculateMaterial() {
    const board = game.board();
    let whiteScore = 0;
    let blackScore = 0;
    
    board.forEach((row) => {
      row.forEach((piece) => {
        if (piece) {
          const value = pieceValueMap[piece.type] || 0;
          if (piece.color === "w") {
            whiteScore += value;
          } else {
            blackScore += value;
          }
        }
      });
    });
    
    return { white: whiteScore, black: blackScore };
  }

  // Helper function to find king square
  function findKingSquare(gameInstance: Chess, color: "w" | "b"): string | null {
    const board = gameInstance.board();
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === "k" && piece.color === color) {
          const file = String.fromCharCode(97 + j);
          const rank = String(8 - i);
          return file + rank;
        }
      }
    }
    return null;
  }

  // AI Logic with different difficulty levels
  function evaluatePosition(gameInstance: Chess, isMaximizing: boolean = true): number {
    let score = 0;
    const board = gameInstance.board();
    
    const pieceValues: Record<string, number> = {
      p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
      P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0
    };
    
    // Piece position bonuses (centralization)
    const positionBonus: Record<number, Record<number, number>> = {
      0: [0, 0, 0, 0, 0, 0, 0, 0],
      1: [0, 0, -10, -10, -10, -10, 0, 0],
      2: [-10, -5, 0, 5, 5, 0, -5, -10],
      3: [-10, -5, 5, 10, 10, 5, -5, -10],
      4: [-10, -5, 5, 10, 10, 5, -5, -10],
      5: [-5, 0, 10, 15, 15, 10, 0, -5],
      6: [-10, -5, 0, 5, 5, 0, -5, -10],
      7: [0, 0, 0, 0, 0, 0, 0, 0]
    };
    
    // Material evaluation with position bonuses
    board.forEach((row, rank) => {
      row.forEach((piece, file) => {
        if (piece) {
          const value = pieceValues[piece.type] || 0;
          const posBonus = positionBonus[rank]?.[file] || 0;
          const totalValue = value + (posBonus * 0.1);
          
          if (piece.color === "b") {
            score += totalValue;
          } else {
            score -= totalValue;
          }
        }
      });
    });
    
    // Check control of center
    const centerFiles = [3, 4];
    const centerRanks = [3, 4];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && centerFiles.includes(j) && centerRanks.includes(i)) {
          if (piece.type !== "k") {
            if (piece.color === "b") score += 0.5;
            else score -= 0.5;
          }
        }
      }
    }
    
    // King safety bonus (prefer castled king)
    const whiteKing = findKingSquare(gameInstance, "w");
    const blackKing = findKingSquare(gameInstance, "b");
    
    if (whiteKing && (whiteKing === "g1" || whiteKing === "c1")) score -= 2; // Castled
    if (blackKing && (blackKing === "g8" || blackKing === "c8")) score += 2; // Castled
    
    return score;
  }

  function getAIMove(currentGame: Chess): string | null {
    const moves = currentGame.moves({ verbose: true });
    
    if (moves.length === 0) return null;
    
    // Filter for different move types
    const captureMoves = moves.filter(m => m.captured);
    const checkMoves = moves.filter(m => {
      const testGame = new Chess(currentGame.fen());
      testGame.move(m.san);
      return testGame.isCheck();
    });
    const checkmateMoves = moves.filter(m => {
      const testGame = new Chess(currentGame.fen());
      testGame.move(m.san);
      return testGame.isCheckmate();
    });
    
    // If checkmate is available, always take it
    if (checkmateMoves.length > 0) {
      return getBestMove(currentGame, checkmateMoves, 3);
    }
    
    switch (difficulty) {
      case 1:
        // Pure blunder mode - random blunders
        if (Math.random() < 0.3 && captureMoves.length > 0) {
          return captureMoves[Math.floor(Math.random() * captureMoves.length)].san;
        }
        return moves[Math.floor(Math.random() * moves.length)].san;
      
      case 2:
        // Beginner - mostly random but avoids terrible blunders
        if (Math.random() < 0.1) {
          return getBestMove(currentGame, moves.slice(0, 3), 0);
        }
        if (Math.random() < 0.3 && checkMoves.length > 0) {
          return checkMoves[Math.floor(Math.random() * checkMoves.length)].san;
        }
        return moves[Math.floor(Math.random() * moves.length)].san;
      
      case 3:
        // Intermediate - balanced
        if (checkmateMoves.length > 0) {
          return getBestMove(currentGame, checkmateMoves, 1);
        }
        if (Math.random() < 0.5 && checkMoves.length > 0) {
          return getBestMove(currentGame, checkMoves.slice(0, 3), 1);
        }
        return getBestMove(currentGame, moves.slice(0, 5), 1);
      
      case 4:
        // Skilled - mostly strategic
        if (Math.random() < 0.1) {
          return moves[Math.floor(Math.random() * moves.length)].san;
        }
        return getBestMove(currentGame, moves.slice(0, 10), 2);
      
      case 5:
        // Master - optimal play
        return getBestMove(currentGame, moves, 3);
      
      default:
        return moves[Math.floor(Math.random() * moves.length)].san;
    }
  }

  function getBestMove(currentGame: Chess, moves: any[], depth: number): string {
    let bestMove = moves[0].san;
    let bestScore = -Infinity;
    
    if (depth === 0) {
      // Level 1-2: simple evaluation
      for (const moveObj of moves) {
        const testGame = new Chess(currentGame.fen());
        testGame.move(moveObj.san);
        
        let score = evaluatePosition(testGame, false);
        
        // Checkmate bonus
        if (testGame.isCheckmate()) score += 10000;
        // Check bonus
        if (testGame.isCheck()) score += 50;
        // Capture bonus
        if (moveObj.captured) score += pieceValueMap[moveObj.captured] * 2;
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = moveObj.san;
        }
      }
    } else {
      // Level 3-5: minimax with lookahead
      for (const moveObj of moves) {
        const testGame = new Chess(currentGame.fen());
        testGame.move(moveObj.san);
        
        let score: number;
        if (testGame.isCheckmate()) {
          score = 10000;
        } else if (testGame.isDraw()) {
          score = 0;
        } else {
          const nextMoves = testGame.moves({ verbose: true });
          if (nextMoves.length === 0) {
            score = evaluatePosition(testGame, false);
          } else {
            // Look ahead for opponent's best response
            let worstScore = Infinity;
            for (const opponentMove of nextMoves.slice(0, Math.min(5, nextMoves.length))) {
              const opponentGame = new Chess(testGame.fen());
              opponentGame.move(opponentMove.san);
              const opponentScore = evaluatePosition(opponentGame, true);
              worstScore = Math.min(worstScore, opponentScore);
            }
            score = evaluatePosition(testGame, false) + (worstScore * 0.5);
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = moveObj.san;
        }
      }
    }
    
    return bestMove;
  }

  function handlePieceClick(square: string) {
    const piece = game.get(square as Square);
    
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }
    
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
    } else if (selectedSquare && possibleMoves.includes(square)) {
      makeMove(selectedSquare, square);
    }
  }

  function makeMove(from: string, to: string, promotion?: string) {
    try {
      const gameCopy = new Chess(game.fen());
      
      // Check if this is a pawn promotion move
      const piece = gameCopy.get(from as Square);
      const isPromotionMove = piece && piece.type === "p" && 
        ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
      
      if (isPromotionMove && !promotion) {
        // Show promotion dialog
        setPromotionMove({ from, to });
        return;
      }
      
      const moveNotation = { from, to, promotion: promotion || "q" };
      const result = gameCopy.move(moveNotation);
      
      if (result) {
        setGame(gameCopy);
        setMoveHistory([...moveHistory, result.san]);
        setSelectedSquare(null);
        setPossibleMoves([]);
        setPromotionMove(null);
        
        // Check game end
        if (gameCopy.isCheckmate()) {
          setGameOver(true);
          const gameResult = gameCopy.turn() === "w" ? "loss" : "win";
          setResult(gameResult);
          // Save game to backend
          if (gameId) {
            const apiResult = gameResult === "win" ? "white" : "black";
            apiClient.finishGame(gameId, apiResult, gameCopy.pgn(), gameCopy.fen()).catch(err => console.error('Failed to save game:', err));
          }
          return;
        }
        
        if (gameCopy.isDraw()) {
          setGameOver(true);
          setResult("draw");
          // Save game to backend
          if (gameId) {
            apiClient.finishGame(gameId, "draw", gameCopy.pgn(), gameCopy.fen()).catch(err => console.error('Failed to save game:', err));
          }
          return;
        }
        
        // AI move
        setIsAIThinking(true);
        setTimeout(() => {
          const aiMove = getAIMove(gameCopy);
          if (aiMove) {
            const aiResult = gameCopy.move(aiMove);
            setGame(new Chess(gameCopy.fen()));
            setMoveHistory(prev => [...prev, aiResult.san]);
            
            if (gameCopy.isCheckmate()) {
              setGameOver(true);
              setResult("loss");
              // Save game to backend
              if (gameId) {
                apiClient.finishGame(gameId, "black", gameCopy.pgn(), gameCopy.fen()).catch(err => console.error('Failed to save game:', err));
              }
            } else if (gameCopy.isDraw()) {
              setGameOver(true);
              setResult("draw");
              // Save game to backend
              if (gameId) {
                apiClient.finishGame(gameId, "draw", gameCopy.pgn(), gameCopy.fen()).catch(err => console.error('Failed to save game:', err));
              }
            }
          }
          setIsAIThinking(false);
        }, 800);
      }
    } catch (error) {
      console.error("Move error:", error);
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string): boolean {
    if (game.turn() !== "w") return false;
    
    try {
      const testGame = new Chess(game.fen());
      const result = testGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      
      if (result) {
        makeMove(sourceSquare, targetSquare);
        return true;
      }
    } catch (error) {
      return false;
    }
    
    return false;
  }

  function resetGame() {
    setGame(new Chess());
    setMoveHistory([]);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setGameOver(false);
    setResult(null);
    setIsAIThinking(false);
    setPromotionMove(null);
  }

  function undoLastMoves() {
    if (moveHistory.length < 2) return;
    
    // Create a new game and replay all but the last 2 moves
    const newGame = new Chess();
    const newMoveHistory = moveHistory.slice(0, -2);
    
    for (const move of newMoveHistory) {
      newGame.move(move);
    }
    
    setGame(newGame);
    setMoveHistory(newMoveHistory);
    setSelectedSquare(null);
    setPossibleMoves([]);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2 }}
                  className="inline-block mb-4"
                >
                  <Trophy className={`w-16 h-16 ${
                    result === "win" ? "text-yellow-500" : result === "draw" ? "text-gray-500" : "text-red-500"
                  }`} />
                </motion.div>
                
                <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">
                  {result === "win" ? "🎉 Вы победили!" : result === "draw" ? "🤝 Ничья!" : "😢 Вы проиграли"}
                </h2>
                
                <p className="text-black/60 dark:text-white/60 mb-6">
                  {result === "win" ? "Отличная игра! Вы одолели ботов." : result === "draw" ? "Хорошая игра! Обоим хватило навыков." : "Не отчаивайтесь! Попробуйте снова."}
                </p>
                
                <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-black/60 dark:text-white/60 mb-1">Уровень сложности</p>
                  <p className="text-2xl font-bold text-black dark:text-white">{difficulty}/5</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={resetGame}
                    className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-all"
                  >
                    Играть ещё
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="flex-1 py-3 bg-black/10 dark:bg-white/10 text-black dark:text-white rounded-xl font-semibold hover:bg-black/20 dark:hover:bg-white/20 transition-all"
                  >
                    В меню
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pawn Promotion Dialog */}
      <AnimatePresence>
        {promotionMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 text-center text-black dark:text-white">
                ♙ Превращение пешки
              </h2>
              
              <div className="grid grid-cols-4 gap-3">
                {[
                  { piece: "q", name: "Ферзь", icon: "♕" },
                  { piece: "r", name: "Ладья", icon: "♖" },
                  { piece: "b", name: "Слон", icon: "♗" },
                  { piece: "n", name: "Конь", icon: "♘" }
                ].map(({ piece, name, icon }) => (
                  <button
                    key={piece}
                    onClick={() => {
                      if (promotionMove) {
                        makeMove(promotionMove.from, promotionMove.to, piece);
                      }
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all hover:scale-105"
                  >
                    <span className="text-4xl">{icon}</span>
                    <span className="text-xs font-semibold text-black/60 dark:text-white/60">{name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-8 py-6 flex items-center justify-between"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm tracking-wide">Главное меню</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={undoLastMoves}
              disabled={moveHistory.length < 2 || isAIThinking || gameOver}
              className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Отменить последний ход"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={resetGame}
              className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all"
              title="Новая игра"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </motion.header>

        {/* Main Game Area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            {/* Chessboard */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-[700px] mx-auto"
            >
              <CustomChessboard
                position={game.fen()}
                onPieceDrop={onDrop}
                onSquareClick={handlePieceClick}
                selectedSquare={selectedSquare}
                possibleMoves={possibleMoves}
                checkSquare={game.isCheck() ? findKingSquare(game, game.turn()) : null}
                checkmateSquare={game.isCheckmate() ? findKingSquare(game, game.turn()) : null}
                boardOrientation="white"
                disabled={isAIThinking || gameOver || game.turn() !== "w"}
              />
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              {/* AI Difficulty */}
              <div className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm tracking-wide text-black/60 dark:text-white/60 mb-4 font-semibold">Уровень сложности IA</h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => !isAIThinking && !gameOver && setDifficulty(level)}
                      disabled={isAIThinking || gameOver}
                      className={`flex-1 py-2 rounded-lg text-sm transition-all font-medium ${
                        difficulty === level
                          ? "bg-black/20 dark:bg-white/20 text-black dark:text-white border border-black/30 dark:border-white/30"
                          : "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10"
                      } ${(isAIThinking || gameOver) && difficulty !== level ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Game Status */}
              <div className={`p-6 rounded-2xl backdrop-blur-xl border transition-all ${
                game.isCheckmate() 
                  ? "bg-red-500/15 border-red-500/30" 
                  : game.isCheck() 
                  ? "bg-yellow-500/15 border-yellow-500/30" 
                  : isAIThinking
                  ? "bg-blue-500/15 border-blue-500/30"
                  : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
              }`}>
                <h3 className="text-sm tracking-wide text-black/60 dark:text-white/60 mb-3 font-semibold">Статус игры</h3>
                <div className="flex items-center gap-2">
                  {isAIThinking && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5"
                    >
                      <div className="w-full h-full rounded-full border-2 border-transparent border-t-blue-500 dark:border-t-blue-400" />
                    </motion.div>
                  )}
                  <p className={`text-lg font-bold ${
                    game.isCheckmate() 
                      ? "text-red-600 dark:text-red-400" 
                      : game.isCheck() 
                      ? "text-yellow-600 dark:text-yellow-400" 
                      : isAIThinking
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-black/80 dark:text-white/80"
                  }`}>
                    {game.isCheckmate()
                      ? game.turn() === "w" ? "❌ МАТ!" : "✓ Вы выиграли!"
                      : game.isCheck()
                      ? "⚠️ ШАХ!"
                      : isAIThinking
                      ? "🤖 IA размышляет..."
                      : game.turn() === "w"
                      ? "♔ Ваш ход"
                      : "♚ Ход IA..."}
                  </p>
                </div>
              </div>

              {/* Material Count */}
              {(() => {
                const mat = calculateMaterial();
                const diff = mat.white - mat.black;
                const isWhiteAhead = diff > 0;
                const absD = Math.abs(diff);
                return (
                  <div className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
                    <h3 className="text-sm tracking-wide text-black/60 dark:text-white/60 mb-4 font-semibold">Материал</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-black/60 dark:text-white/60">♔ Вы (белые)</span>
                        <span className="font-semibold text-black dark:text-white">{mat.white}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-black/60 dark:text-white/60">♚ IA (чёрные)</span>
                        <span className="font-semibold text-black dark:text-white">{mat.black}</span>
                      </div>
                      {absD > 0 && (
                        <div className={`flex justify-between items-center pt-3 border-t border-black/10 dark:border-white/10 ${
                          isWhiteAhead ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}>
                          <span className="text-sm font-semibold">{isWhiteAhead ? "Вы впереди" : "IA впереди"}</span>
                          <span className="font-bold">+{absD}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Move History */}
              <div className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm tracking-wide text-black/60 dark:text-white/60 mb-4 font-semibold">История ходов</h3>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {moveHistory.length === 0 ? (
                    <p className="text-black/40 dark:text-white/40 text-sm">Нет ходов</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-black/40 dark:text-white/40 text-xs w-6">{i + 1}.</span>
                          <span className="text-black/80 dark:text-white/80 text-xs">{moveHistory[i * 2] || ""}</span>
                          <span className="text-black/80 dark:text-white/80 text-xs">{moveHistory[i * 2 + 1] || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Game Stats */}
              <div className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm tracking-wide text-black/60 dark:text-white/60 mb-4 font-semibold">Статистика</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black/60 dark:text-white/60">Ходы</span>
                    <span className="font-semibold text-black dark:text-white">{moveHistory.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black/60 dark:text-white/60">Сложность IA</span>
                    <span className="font-semibold text-black dark:text-white flex items-center gap-1">
                      <span className="text-xs">{'★'.repeat(difficulty)}{'☆'.repeat(5-difficulty)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Game Info */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-black/60 dark:text-white/60">
                <p className="mb-2">♔ Вы: белые фигуры</p>
                <p>♚ IA: чёрные фигуры</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}