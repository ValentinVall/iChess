import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useParams } from "react-router";
import { Chess, Square } from "chess.js";
import { ArrowLeft, Brain, Crown, RotateCcw, Swords, Trophy, UserRound, X } from "lucide-react";
import { CustomChessboard } from "./CustomChessboard";
import { BrandHomeLink } from "./BrandHomeLink";
import { Slider } from "./ui/slider";
import { apiClient, type ActiveGameState, type PlayerColor } from "../../lib/api";
import { getSoundCueFromState, playSoundCue } from "../../lib/gameSounds";
import { DEFAULT_STOCKFISH_LEVEL, getStockfishLevelMeta, stockfishLevels } from "../stockfishLevels";

interface UserProfile {
  id: number;
  playerNumber: string | null;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export function AIGame() {
  const checkmateTimeoutRef = useRef<number | null>(null);
  const previousMoveCountRef = useRef(0);
  const navigate = useNavigate();
  const { gameId: routeGameId } = useParams();
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState(new Chess());
  const [selectedLevel, setSelectedLevel] = useState(DEFAULT_STOCKFISH_LEVEL);
  const [activeLevel, setActiveLevel] = useState(DEFAULT_STOCKFISH_LEVEL);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"win" | "loss" | "draw" | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
  const [isResignConfirmOpen, setIsResignConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedPlayerColor, setSelectedPlayerColor] = useState<PlayerColor>("white");
  const [activePlayerColor, setActivePlayerColor] = useState<PlayerColor>("white");
  const [isGameOverModalDismissed, setIsGameOverModalDismissed] = useState(false);

  const selectedMeta = getStockfishLevelMeta(selectedLevel);
  const activeMeta = getStockfishLevelMeta(activeLevel);
  const keyDifficultyStops = [
    { level: 1, label: "Noob" },
    { level: 5, label: "Amateur" },
    { level: 10, label: "CM" },
    { level: 13, label: "GM" },
    { level: 15, label: "WC" },
  ];
  const hasActiveGame = Boolean(gameId);
  const playerTurn = activePlayerColor === "white" ? "w" : "b";
  const aiTurn = activePlayerColor === "white" ? "b" : "w";

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await apiClient.getProfile();
        setProfile(profileData);
      } catch (profileError) {
        console.error("Failed to load player profile for AI game:", profileError);
      }
    };

    void loadProfile();

    return () => {
      if (checkmateTimeoutRef.current !== null) {
        window.clearTimeout(checkmateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!routeGameId || routeGameId === gameId) {
      return;
    }

    const resolvedRouteGameId = routeGameId;

    let isDisposed = false;

    async function loadExistingGame() {
      try {
        setIsStartingGame(true);
        setError(null);

        const [gameResponse, profileData] = await Promise.all([
          apiClient.getGameState(resolvedRouteGameId),
          profile ? Promise.resolve(profile) : apiClient.getProfile(),
        ]);

        if (isDisposed) {
          return;
        }

        if (gameResponse.metadata.mode !== "ai") {
          throw new Error("This game is not an AI match");
        }

        const nextProfile = {
          id: Number(profileData.id),
          playerNumber: profileData.playerNumber,
          username: profileData.username,
          rating: profileData.rating,
          wins: profileData.wins,
          losses: profileData.losses,
          draws: profileData.draws,
        };

        setProfile(nextProfile);

        const restoredPlayerColor = gameResponse.metadata.whitePlayerId === String(nextProfile.id) ? "white" : "black";
        const restoredLevel = Number(gameResponse.metadata.difficulty) || DEFAULT_STOCKFISH_LEVEL;

        clearPendingGameOver();
        previousMoveCountRef.current = 0;
        setSelectedLevel(restoredLevel);
        setActiveLevel(restoredLevel);
        setActivePlayerColor(restoredPlayerColor);
        setGameId(gameResponse.metadata.id);
        setIsAIThinking(false);
        setPromotionMove(null);
        setIsResignConfirmOpen(false);
        setIsGameOverModalDismissed(false);
        applyServerState(gameResponse.state);
      } catch (loadError) {
        if (!isDisposed) {
          setError(loadError instanceof Error ? loadError.message : "Failed to restore AI game");
          navigate("/ai-game", { replace: true });
        }
      } finally {
        if (!isDisposed) {
          setIsStartingGame(false);
        }
      }
    }

    void loadExistingGame();

    return () => {
      isDisposed = true;
    };
  }, [gameId, navigate, profile, routeGameId]);

  function clearPendingGameOver() {
    if (checkmateTimeoutRef.current !== null) {
      window.clearTimeout(checkmateTimeoutRef.current);
      checkmateTimeoutRef.current = null;
    }
  }

  const pieceValueMap: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
    P: 1,
    N: 3,
    B: 3,
    R: 5,
    Q: 9,
    K: 0,
  };

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

  function findKingSquare(gameInstance: Chess, color: "w" | "b") {
    const board = gameInstance.board();

    for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        const piece = board[rankIndex][fileIndex];
        if (piece && piece.type === "k" && piece.color === color) {
          const file = String.fromCharCode(97 + fileIndex);
          const rank = String(8 - rankIndex);
          return `${file}${rank}`;
        }
      }
    }

    return null;
  }

  function getLastMoveSquaresFromPgn(pgn: string) {
    if (!pgn.trim()) {
      return [];
    }

    try {
      const replayGame = new Chess();
      replayGame.loadPgn(pgn);
      const history = replayGame.history({ verbose: true });
      const latestMove = history[history.length - 1];

      return latestMove ? [latestMove.from, latestMove.to] : [];
    } catch {
      return [];
    }
  }

  function applyServerState(nextState: ActiveGameState) {
    const nextGame = new Chess(nextState.fen);
    const nextMoveCount = nextState.moveHistory?.length || 0;

    if (nextMoveCount > previousMoveCountRef.current) {
      const soundCue = getSoundCueFromState(nextState);
      if (soundCue) {
        playSoundCue(soundCue);
      }
    }

    previousMoveCountRef.current = nextMoveCount;

    setGame(nextGame);
    setMoveHistory(nextState.moveHistory || []);
    setLastMoveSquares(getLastMoveSquaresFromPgn(nextState.pgn));
    setSelectedSquare(null);
    setPossibleMoves([]);

    const finished = nextState.isCheckmate || nextState.isDraw || nextState.result !== undefined;
    clearPendingGameOver();

    if (nextState.isCheckmate) {
      setGameOver(false);
      checkmateTimeoutRef.current = window.setTimeout(() => {
        setGameOver(true);
        checkmateTimeoutRef.current = null;
      }, 1000);
    } else {
      setGameOver(finished);
    }

    if (nextState.result === "white") {
      setResult(activePlayerColor === "white" ? "win" : "loss");
    } else if (nextState.result === "black") {
      setResult(activePlayerColor === "black" ? "win" : "loss");
    } else if (nextState.result === "draw" || nextState.isDraw) {
      setResult("draw");
    } else {
      setResult(null);
    }
  }

  async function startNewGame(level: number) {
    try {
      clearPendingGameOver();
      setIsStartingGame(true);
      setError(null);
      setIsAIThinking(false);
      setPromotionMove(null);
      setIsResignConfirmOpen(false);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setLastMoveSquares([]);
      setGameOver(false);
      setResult(null);
      setIsGameOverModalDismissed(false);
      previousMoveCountRef.current = 0;

      const response = await apiClient.createGame(level, selectedPlayerColor);
      setSelectedLevel(level);
      setActiveLevel(level);
      setActivePlayerColor(selectedPlayerColor);
      setGameId(response.game.id);
      navigate(`/game/ai/${response.game.id}`, { replace: true });
      applyServerState(response.state);

      if (selectedPlayerColor === "black") {
        setIsAIThinking(true);
        const aiResponse = await apiClient.requestAIMove(response.game.id);
        applyServerState({
          fen: aiResponse.result.fen,
          pgn: aiResponse.result.pgn,
          turn: aiResponse.result.fen.split(" ")[1],
          isCheck: aiResponse.result.isCheck,
          isCheckmate: aiResponse.result.isCheckmate,
          isDraw: aiResponse.result.isDraw,
          result: aiResponse.result.result,
          moveHistory: aiResponse.result.moveHistory,
          moves: aiResponse.result.moves,
          legalMoves: [],
        });
      }
    } catch (createError) {
      console.error("Failed to create game:", createError);
      setError(createError instanceof Error ? createError.message : "Failed to start AI game");
    } finally {
      setIsAIThinking(false);
      setIsStartingGame(false);
    }
  }

  function handlePieceClick(square: string) {
    if (!hasActiveGame || isAIThinking || gameOver || game.turn() !== playerTurn) {
      return;
    }

    const piece = game.get(square as Square);

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setPossibleMoves(moves.map((move) => move.to));
      return;
    }

    if (selectedSquare && possibleMoves.includes(square)) {
      void makeMove(selectedSquare, square);
    }
  }

  async function makeMove(from: string, to: string, promotion?: string) {
    try {
      if (!gameId || isAIThinking || gameOver) {
        return;
      }

      const gameCopy = new Chess(game.fen());
      const piece = gameCopy.get(from as Square);
      const isPromotionCandidate =
        piece &&
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));

      if (isPromotionCandidate && !promotion) {
        setPromotionMove({ from, to });
        return;
      }

      setError(null);
      const moveResponse = await apiClient.makeGameMove(gameId, {
        from,
        to,
        promotion: promotion || "q",
      });

      applyServerState({
        fen: moveResponse.result.fen,
        pgn: moveResponse.result.pgn,
        turn: moveResponse.result.fen.split(" ")[1],
        isCheck: moveResponse.result.isCheck,
        isCheckmate: moveResponse.result.isCheckmate,
        isDraw: moveResponse.result.isDraw,
        result: moveResponse.result.result,
        moveHistory: moveResponse.result.moveHistory,
        moves: moveResponse.result.moves,
        legalMoves: [],
      });
      setPromotionMove(null);

      if (moveResponse.result.gameStatus === "completed") {
        return;
      }

      if (new Chess(moveResponse.result.fen).turn() === aiTurn) {
        setIsAIThinking(true);
        const aiResponse = await apiClient.requestAIMove(gameId);
        applyServerState({
          fen: aiResponse.result.fen,
          pgn: aiResponse.result.pgn,
          turn: aiResponse.result.fen.split(" ")[1],
          isCheck: aiResponse.result.isCheck,
          isCheckmate: aiResponse.result.isCheckmate,
          isDraw: aiResponse.result.isDraw,
          result: aiResponse.result.result,
          moveHistory: aiResponse.result.moveHistory,
          moves: aiResponse.result.moves,
          legalMoves: [],
        });
      }
    } catch (moveError) {
      console.error("Move error:", moveError);
      setError(moveError instanceof Error ? moveError.message : "Move failed");
    } finally {
      setIsAIThinking(false);
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!hasActiveGame || game.turn() !== playerTurn || isAIThinking || gameOver) {
      return false;
    }

    try {
      const testGame = new Chess(game.fen());
      const testMove = testGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" });

      if (testMove) {
        void makeMove(sourceSquare, targetSquare);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  function resetGame() {
    clearPendingGameOver();
    setIsResignConfirmOpen(false);
    void startNewGame(selectedLevel);
  }

  async function resignCurrentGame() {
    try {
      if (!gameId || gameOver) {
        return;
      }

      setIsResignConfirmOpen(false);
      setError(null);
      await apiClient.resignGame(gameId);
      setGameOver(true);
      setResult("loss");
    } catch (resignError) {
      setError(resignError instanceof Error ? resignError.message : "Failed to resign game");
    }
  }

  const currentProfile = profile ?? {
    id: 0,
    playerNumber: "#--",
    username: "player",
    rating: 800,
    wins: 0,
    losses: 0,
    draws: 0,
  };

  const topPlayerCardClassName =
    "flex items-center justify-between gap-3 rounded-[1.5rem] border border-black/10 bg-white/75 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10";
  const bottomPlayerCardClassName =
    "flex items-center justify-between gap-3 rounded-[1.5rem] border border-black/10 bg-[#f5f5f5]/95 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10";

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-black/5 blur-[150px] dark:bg-white/5" />

      <AnimatePresence>
        {gameOver && !isGameOverModalDismissed && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/38 px-4"
          >
            <motion.div
              initial={{ y: 28, scale: 0.965, opacity: 0, filter: "blur(10px)" }}
              animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 18, scale: 0.985, opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl border border-white/45 bg-white/96 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1a1a]/94"
            >
              <button
                onClick={() => setIsGameOverModalDismissed(true)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/65 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-white/15 dark:hover:text-white"
                aria-label="Закрыть результат партии"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-4 inline-block"
                >
                  <Trophy className={`h-16 w-16 ${result === "win" ? "text-yellow-500" : result === "draw" ? "text-gray-500" : "text-red-500"}`} />
                </motion.div>

                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">
                  {result === "win" ? " You won!" : result === "draw" ? " It's a draw!" : " You lost"}
                </h2>

                <p className="mb-6 text-black/60 dark:text-white/60">
                  {result === "win"
                    ? "Great game. You defeated the AI at the selected level."
                    : result === "draw"
                    ? "Strong game. You held a draw against the AI."
                    : "The AI was stronger in this game. Try another level and play again."}
                </p>

                <div className="mb-6 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                  <p className="mb-1 text-sm text-black/60 dark:text-white/60">Текущий соперник</p>
                  <p className="text-2xl font-bold text-black dark:text-white">{activeMeta.title} · {activeMeta.elo} Elo</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetGame}
                    className="flex-1 rounded-xl bg-black py-3 font-semibold text-white transition-all hover:opacity-90 dark:bg-white dark:text-black"
                  >
                    Играть ещё
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    В меню
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isResignConfirmOpen && !gameOver && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/38 px-4"
          >
            <motion.div
              initial={{ y: 28, scale: 0.965, opacity: 0, filter: "blur(10px)" }}
              animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 18, scale: 0.985, opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl border border-white/45 bg-white/96 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1a1a]/94"
            >
              <button
                onClick={() => setIsResignConfirmOpen(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/65 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-white/15 dark:hover:text-white"
                aria-label="Закрыть окно сдачи"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  <X className="h-10 w-10" />
                </motion.div>

                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">
                  Подтвердить сдачу?
                </h2>

                <p className="mb-6 text-black/60 dark:text-white/60">
                  Партия завершится поражением. Если нажали случайно, можно вернуться и продолжить игру.
                </p>

                <div className="mb-6 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                  <p className="mb-1 text-sm text-black/60 dark:text-white/60">Текущий соперник</p>
                  <p className="text-2xl font-bold text-black dark:text-white">{activeMeta.title} · {activeMeta.elo} Elo</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsResignConfirmOpen(false)}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    Продолжить игру
                  </button>
                  <button
                    onClick={() => void resignCurrentGame()}
                    className="flex-1 rounded-xl bg-rose-600 py-3 font-semibold text-white transition-all hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400"
                  >
                    Сдаться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {promotionMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-4 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-[#1a1a1a]"
            >
              <button
                onClick={() => setPromotionMove(null)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/65 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-white/15 dark:hover:text-white"
                aria-label="Закрыть выбор превращения"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="mb-6 text-center text-2xl font-bold text-black dark:text-white">♙ Превращение пешки</h2>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { piece: "q", name: "Ферзь", icon: "♕" },
                  { piece: "r", name: "Ладья", icon: "♖" },
                  { piece: "b", name: "Слон", icon: "♗" },
                  { piece: "n", name: "Конь", icon: "♘" },
                ].map(({ piece, name, icon }) => (
                  <button
                    key={piece}
                    onClick={() => promotionMove && void makeMove(promotionMove.from, promotionMove.to, piece)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-black/10 bg-black/5 p-4 transition-all hover:scale-105 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
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
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center px-4 py-4 md:px-6 md:py-5 lg:px-8"
        >
          <div className="flex items-center gap-4">
            <BrandHomeLink />
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm tracking-wide">Главное меню</span>
            </button>
          </div>
        </motion.header>

        <div className="flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mx-auto w-full max-w-[680px]"
            >
              {hasActiveGame ? (
                <div className="space-y-3 md:space-y-4">
                  <div className={topPlayerCardClassName}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-[#d9d9d9] text-black/75 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
                        <Brain className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-black/45 dark:text-white/45">Opponent</p>
                        <p className="mt-1 text-lg font-semibold text-black/85 dark:text-white/85">AI {activeMeta.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-black/45 dark:text-white/45">Engine Elo</p>
                      <p className="mt-1 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">{activeMeta.elo}</p>
                    </div>
                  </div>

                  <CustomChessboard
                    position={game.fen()}
                    onPieceDrop={onDrop}
                    onSquareClick={handlePieceClick}
                    selectedSquare={selectedSquare}
                    possibleMoves={possibleMoves}
                    lastMoveSquares={lastMoveSquares}
                    checkSquare={game.isCheck() ? findKingSquare(game, game.turn()) : null}
                    checkmateSquare={game.isCheckmate() ? findKingSquare(game, game.turn()) : null}
                    boardOrientation={activePlayerColor}
                    disabled={isAIThinking || gameOver || game.turn() !== playerTurn}
                  />

                  <div className={bottomPlayerCardClassName}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white text-black/75 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-black/45 dark:text-white/45">You</p>
                        <p className="mt-1 text-lg font-semibold text-black/85 dark:text-white/85">@{currentProfile.username}</p>
                        <p className="mt-1 text-xs md:text-sm text-black/50 dark:text-white/50">{currentProfile.playerNumber || "#--"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-black/45 dark:text-white/45">Your Elo</p>
                      <p className="mt-1 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">{currentProfile.rating}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <CustomChessboard
                    position="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    onPieceDrop={() => false}
                    boardOrientation={selectedPlayerColor}
                    disabled
                  />
                  <div className="absolute inset-0 flex items-center justify-center px-4 md:px-6">
                      <div className="rounded-3xl border border-black/10 bg-white/80 px-6 py-5 text-center shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-black/45">
                        <Crown className="mx-auto h-8 w-8 text-black/70 dark:text-white/70" />
                        <p className="mt-3 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">Select your AI level</p>
                        <p className="mt-2 text-xs md:text-sm text-black/50 dark:text-white/50">The board stays still until you confirm the matchup in the sidebar.</p>
                      </div>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-4 md:space-y-5"
            >
              {!hasActiveGame ? (
                <div className="rounded-[1.75rem] border border-black/10 bg-black/5 p-5 md:p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Play VS AI</p>
                      <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight">Choose Level</h1>
                    </div>
                    <div className={`rounded-2xl border border-black/10 bg-gradient-to-br ${selectedMeta.accent} px-4 py-3 text-right dark:border-white/10`}>
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Target Elo</p>
                      <p className="mt-2 text-2xl font-light text-black/85 dark:text-white/85">{selectedMeta.elo}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { value: "white", title: "Play White" },
                        { value: "black", title: "Play Black" },
                      ] as const).map((colorOption) => (
                        <button
                          key={colorOption.value}
                          onClick={() => setSelectedPlayerColor(colorOption.value)}
                          className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                            selectedPlayerColor === colorOption.value
                              ? "border-black/25 bg-white/80 shadow-lg dark:border-white/25 dark:bg-white/10"
                              : "border-black/10 bg-white/45 hover:border-black/20 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                          }`}
                        >
                          <p className="text-sm font-medium text-black/85 dark:text-white/85">{colorOption.title}</p>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-[1.5rem] border border-black/10 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <motion.div
                        key={selectedLevel}
                        initial={{ opacity: 0.72, y: 8, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
                        className={`rounded-[1.35rem] border border-black/10 bg-gradient-to-br ${selectedMeta.accent} p-4 dark:border-white/10`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Difficulty</p>
                            <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">AI {selectedMeta.title}</p>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-black/10 bg-white/55 px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-black/20">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Level {selectedLevel}</p>
                            <p className="mt-1 text-lg font-light text-black/85 dark:text-white/85">{selectedMeta.elo}</p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">Elo</p>
                          </div>
                        </div>
                      </motion.div>

                      <div className="mt-4 rounded-2xl border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(0,0,0,0.03))] px-4 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
                        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-black/38 dark:text-white/38">
                          <span>Soft</span>
                          <span>Competitive</span>
                          <span>Elite</span>
                        </div>

                        <Slider
                          value={[selectedLevel]}
                          min={1}
                          max={stockfishLevels.length}
                          step={1}
                          onValueChange={(value) => setSelectedLevel(value[0] ?? DEFAULT_STOCKFISH_LEVEL)}
                          className="w-full"
                        />

                        <div className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
                          {stockfishLevels.map((level) => (
                            <div
                              key={level.level}
                              className={`h-1.5 rounded-full transition-all ${
                                level.level <= selectedLevel
                                  ? "bg-black/65 dark:bg-white/70"
                                  : "bg-black/10 dark:bg-white/10"
                              }`}
                            />
                          ))}
                        </div>

                        <div className="relative mt-5 h-8">
                          {keyDifficultyStops.map((stop) => (
                            <div
                              key={stop.level}
                              className="absolute top-0 -translate-x-1/2 text-center"
                              style={{ left: `${((stop.level - 1) / (stockfishLevels.length - 1)) * 100}%` }}
                            >
                              <div className={`mx-auto h-2 w-px ${stop.level <= selectedLevel ? "bg-black/55 dark:bg-white/60" : "bg-black/18 dark:bg-white/18"}`} />
                              <span className={`mt-2 block text-[10px] uppercase tracking-[0.18em] transition-colors ${stop.level === selectedLevel ? "text-black dark:text-white" : "text-black/38 dark:text-white/38"}`}>
                                {stop.label}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40">
                          <span>{stockfishLevels[0]?.title}</span>
                          <span>{selectedLevel} / {stockfishLevels.length}</span>
                          <span>{stockfishLevels[stockfishLevels.length - 1]?.title}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => void startNewGame(selectedLevel)}
                    disabled={isStartingGame}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-black/20 bg-black px-5 py-3.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 dark:border-white/20 dark:bg-white dark:text-black"
                  >
                    <Swords className="h-4 w-4" />
                    {isStartingGame ? "Preparing AI..." : `Start as ${selectedPlayerColor} vs AI ${selectedMeta.title}`}
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              ) : null}

              {hasActiveGame ? (
                <>
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold tracking-wide text-black/60 dark:text-white/60">Current Opponent</h3>
                        <p className="mt-2 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">AI {activeMeta.title}</p>
                      </div>
                      <div className={`rounded-2xl border border-black/10 bg-gradient-to-br ${activeMeta.accent} px-4 py-3 text-right dark:border-white/10`}>
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Estimated Strength</p>
                        <p className="mt-2 text-2xl font-light text-black/85 dark:text-white/85">{activeMeta.elo}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-5 backdrop-blur-xl transition-all ${
                      game.isCheckmate()
                        ? "border-red-500/30 bg-red-500/15"
                        : game.isCheck()
                        ? "border-yellow-500/30 bg-yellow-500/15"
                        : isAIThinking
                        ? "border-blue-500/30 bg-blue-500/15"
                        : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    }`}
                  >
                    <h3 className="mb-3 text-sm font-semibold tracking-wide text-black/60 dark:text-white/60">Game Status</h3>
                    <p
                      className={`text-base md:text-lg font-bold ${
                        game.isCheckmate()
                          ? "text-red-600 dark:text-red-400"
                          : game.isCheck()
                          ? "text-yellow-600 dark:text-yellow-400"
                          : isAIThinking
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-black/80 dark:text-white/80"
                      }`}
                    >
                      {game.isCheckmate()
                        ? game.turn() === "w"
                          ? "❌ МАТ!"
                          : "✓ Вы выиграли!"
                        : game.isCheck()
                        ? "⚠️ ШАХ!"
                        : isAIThinking
                        ? "🤖 AI is thinking..."
                        : game.turn() === playerTurn
                        ? "♔ Ваш ход"
                        : "♚ AI to move..."}
                    </p>
                  </div>

                  {(() => {
                    const mat = calculateMaterial();
                    const playerMaterial = activePlayerColor === "white" ? mat.white : mat.black;
                    const aiMaterial = activePlayerColor === "white" ? mat.black : mat.white;
                    const diff = playerMaterial - aiMaterial;
                    const isPlayerAhead = diff > 0;
                    const absDiff = Math.abs(diff);
                    return (
                      <div className="rounded-2xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                        <h3 className="mb-4 text-sm font-semibold tracking-wide text-black/60 dark:text-white/60">Material</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-black/60 dark:text-white/60">♔ Вы ({activePlayerColor === "white" ? "белые" : "чёрные"})</span>
                            <span className="font-semibold text-black dark:text-white">{playerMaterial}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-black/60 dark:text-white/60">♚ AI</span>
                            <span className="font-semibold text-black dark:text-white">{aiMaterial}</span>
                          </div>
                          {absDiff > 0 ? (
                            <div className={`flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10 ${isPlayerAhead ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              <span className="text-sm font-semibold">{isPlayerAhead ? "You are ahead" : "AI is ahead"}</span>
                              <span className="font-bold">+{absDiff}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="rounded-2xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-black/60 dark:text-white/60">Match Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setIsResignConfirmOpen(true)}
                        disabled={isAIThinking || gameOver}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 transition-all hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/15"
                        title="Сдаться"
                      >
                        <X className="h-4 w-4" />
                        <span>Сдаться</span>
                      </button>
                      <button
                        onClick={resetGame}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15"
                        title="Новая игра"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Заново</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-4 text-sm font-semibold tracking-wide text-black/60 dark:text-white/60">Move History</h3>
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {moveHistory.length === 0 ? (
                        <p className="text-sm text-black/40 dark:text-white/40">Нет ходов</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, index) => (
                            <div key={index} className="flex gap-2">
                              <span className="w-6 text-xs text-black/40 dark:text-white/40">{index + 1}.</span>
                              <span className="text-xs text-black/80 dark:text-white/80">{moveHistory[index * 2] || ""}</span>
                              <span className="text-xs text-black/80 dark:text-white/80">{moveHistory[index * 2 + 1] || ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}