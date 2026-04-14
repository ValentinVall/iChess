import { useEffect, useRef, useState } from "react";
import { Chess, Square } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, ArrowLeft, Bolt, Clock3, Flag, Handshake, RotateCcw, Swords, Trophy, UserRound, Users, X, Zap } from "lucide-react";
import { BrandHomeLink } from "./BrandHomeLink";
import { CustomChessboard } from "./CustomChessboard";
import { apiClient, type ActiveGameState } from "../../lib/api";
import { clearActiveOnlineMatch, saveActiveOnlineMatch } from "../activeOnlineMatch";
import { getSoundCueFromState, playSoundCue } from "../../lib/gameSounds";
import { wsService } from "../../lib/socket";

type OnlinePanelMode = "quick" | "friend" | "tournament";

interface UserProfile {
  id: number;
  playerNumber: string | null;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MatchFoundPayload {
  gameId: string;
  color: "white" | "black";
  opponent: {
    id: string;
    playerNumber: string;
    username: string;
    rating: number;
  };
  state: ActiveGameState;
}

interface MoveMadePayload {
  gameId: string;
  move: {
    from: string;
    to: string;
    san: string;
  };
  state: ActiveGameState;
}

interface GameOverPayload {
  gameId: string;
  winner: string | null;
  reason: "checkmate" | "draw" | "resign" | "timeout";
  state: ActiveGameState;
  ratingChanges?: {
    white: { before: number; after: number; delta: number };
    black: { before: number; after: number; delta: number };
  };
}

interface RematchRequestedPayload {
  gameId: string;
  requestedBy: {
    id: string;
    username: string;
  };
}

interface RematchResponsePayload {
  gameId: string;
  status: "pending" | "declined";
}

interface DrawOfferedPayload {
  gameId: string;
  offeredBy: string;
}

interface DrawOfferStatusPayload {
  gameId: string;
  status: "pending" | "declined";
}

interface QueueStatusPayload {
  status: "idle" | "searching" | "matched";
  queueId: string;
}

type TimeControl = {
  id: string;
  label: string;
  summary: string;
  accent: string;
};

const timeControls: TimeControl[] = [
  {
    id: "bullet-1-0",
    label: "1 min",
    summary: "Bullet",
    accent: "from-[#E63946]/88 to-[#E63946]/24",
  },
  {
    id: "blitz-3-0",
    label: "3 min",
    summary: "Blitz",
    accent: "from-[#F4A261]/88 to-[#F4A261]/24",
  },
  {
    id: "rapid-10-0",
    label: "10 min",
    summary: "Rapid",
    accent: "from-[#2A9D8F]/88 to-[#2A9D8F]/24",
  },
];

const panelModes = [
  { id: "quick" as const, label: "New Game", icon: Swords },
  { id: "friend" as const, label: "Friendly", icon: Users },
  { id: "tournament" as const, label: "Tournament", icon: Trophy },
];

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

function findKingSquare(game: Chess, color: "w" | "b") {
  const board = game.board();

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

export function OnlineGame() {
  const previousMoveCountRef = useRef(0);
  const suppressNextSoundRef = useRef(false);
  const navigate = useNavigate();
  const { gameId: routeGameId } = useParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [panelMode, setPanelMode] = useState<OnlinePanelMode>("quick");
  const [selectedControlId, setSelectedControlId] = useState<string>("rapid-10-0");
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [opponent, setOpponent] = useState<MatchFoundPayload["opponent"] | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [gameResult, setGameResult] = useState<"win" | "loss" | "draw" | null>(null);
  const [gameOverReason, setGameOverReason] = useState<"checkmate" | "draw" | "resign" | "timeout" | null>(null);
  const [isQueuePanelVisible, setIsQueuePanelVisible] = useState(true);
  const [isRematchRequestPending, setIsRematchRequestPending] = useState(false);
  const [incomingRematchOffer, setIncomingRematchOffer] = useState<RematchRequestedPayload | null>(null);
  const [isResignConfirmOpen, setIsResignConfirmOpen] = useState(false);
  const [isDrawOfferPending, setIsDrawOfferPending] = useState(false);
  const [incomingDrawOffer, setIncomingDrawOffer] = useState<DrawOfferedPayload | null>(null);
  const [isResultModalDismissed, setIsResultModalDismissed] = useState(false);
  const [clockState, setClockState] = useState<ActiveGameState["clock"] | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [ratingDelta, setRatingDelta] = useState<{ before: number; after: number; delta: number } | null>(null);

  const playerTurn = playerColor === "white" ? "w" : "b";
  const hasActiveMatch = Boolean(gameId) && gameOverReason === null;
  const queueControlsLocked = isSearchingMatch || hasActiveMatch;
  const canInteractWithBoard = Boolean(gameId) && game.turn() === playerTurn && gameOverReason === null;
  const isResultModalOpen = Boolean(gameId) && gameOverReason !== null && gameResult !== null && !isResultModalDismissed;

  useEffect(() => {
    let isDisposed = false;

    const loadProfileAndSocket = async () => {
      try {
        const profileData = await apiClient.getProfile();
        const token = await apiClient.getToken();

        if (!token) {
          throw new Error("Missing auth token for realtime connection");
        }

        await wsService.connect(token, "online-game");

        if (isDisposed) {
          return;
        }

        setProfile(profileData);
        setIsSocketReady(true);

        const ownUserId = String(profileData.id);

        const handleQueueStatus = (payload: QueueStatusPayload) => {
          if (payload.queueId !== "rapid-10-0") {
            return;
          }

          setIsSearchingMatch(payload.status === "searching");

          if (payload.status === "idle" && routeGameId) {
            navigate("/online-game", { replace: true });
          }
        };

        const handleMatchFound = (payload: MatchFoundPayload) => {
          suppressNextSoundRef.current = true;
          setIsQueuePanelVisible(false);
          setGameId(payload.gameId);
          setPlayerColor(payload.color);
          setOpponent(payload.opponent);
          setGameResult(null);
          setGameOverReason(null);
          setIsSearchingMatch(false);
          setIsRematchRequestPending(false);
          setIncomingRematchOffer(null);
          setIsResignConfirmOpen(false);
          setIsDrawOfferPending(false);
          setIncomingDrawOffer(null);
          setIsResultModalDismissed(false);
          setRatingDelta(null);
          setRealtimeError(null);
          setStatusNote(`Match found against @${payload.opponent.username}. You play ${payload.color}.`);
          saveActiveOnlineMatch({
            ownerId: ownUserId,
            gameId: payload.gameId,
            opponentUsername: payload.opponent.username,
            playerColor: payload.color,
            updatedAt: new Date().toISOString(),
          });
          navigate(`/game/live/${payload.gameId}`, { replace: true });
          applyRealtimeState(payload.state);
          wsService.joinGame(payload.gameId);
        };

        const handleMoveMade = (payload: MoveMadePayload) => {
          if (payload.gameId !== gameId && gameId !== null && payload.gameId !== gameId) {
            return;
          }

          setRealtimeError(null);
          applyRealtimeState(payload.state);
        };

        const handleMoveError = (payload: { error: string }) => {
          setRealtimeError(payload.error);
        };

        const handleMatchmakingError = (payload: { error: string }) => {
          setIsSearchingMatch(false);
          setIsRematchRequestPending(false);
          setRealtimeError(payload.error);
        };

        const handleGameOver = (payload: GameOverPayload) => {
          clearActiveOnlineMatch();
          setGameOverReason(payload.reason);
          setGameResult(
            payload.winner === null ? "draw" : payload.winner === ownUserId ? "win" : "loss"
          );

          if (payload.ratingChanges) {
            const selfRating = playerColor === "white" ? payload.ratingChanges.white : payload.ratingChanges.black;
            const opponentRating = playerColor === "white" ? payload.ratingChanges.black : payload.ratingChanges.white;

            setRatingDelta(selfRating);
            setProfile((current) => current ? { ...current, rating: selfRating.after } : current);
            setOpponent((current) => current ? { ...current, rating: opponentRating.after } : current);
          } else {
            setRatingDelta(null);
          }

          setStatusNote(
            payload.reason === "checkmate" || payload.reason === "resign" || payload.reason === "timeout"
              ? payload.winner === ownUserId
                ? payload.reason === "resign"
                  ? "Opponent resigned. You won the game."
                  : payload.reason === "timeout"
                  ? "Opponent lost on time. You won the game."
                  : "Checkmate. You won the game."
                : payload.reason === "resign"
                ? "You resigned the game."
                : payload.reason === "timeout"
                ? "You lost on time."
                : "Checkmate. You lost the game."
              : "The game finished in a draw."
          );
          setIsDrawOfferPending(false);
          setIncomingDrawOffer(null);
          setIsResignConfirmOpen(false);
          setIsResultModalDismissed(false);
          applyRealtimeState(payload.state);
        };

        const handleRematchRequested = (payload: RematchRequestedPayload) => {
          setIncomingRematchOffer(payload);
          setStatusNote(`@${payload.requestedBy.username} offered a rematch.`);
        };

        const handleRematchResponse = (payload: RematchResponsePayload) => {
          if (payload.status === "pending") {
            setIsRematchRequestPending(true);
            return;
          }

          setIsRematchRequestPending(false);
          setStatusNote(`@${opponent?.username ?? "Opponent"} declined the rematch.`);
        };

        const handleUserLeft = () => {
          setStatusNote("Opponent disconnected from the room.");
        };

        const handleDrawOffered = (payload: DrawOfferedPayload) => {
          if (payload.gameId !== gameId && gameId !== null && payload.gameId !== gameId) {
            return;
          }

          setIncomingDrawOffer(payload);
          setStatusNote("Opponent offered a draw.");
        };

        const handleDrawOfferStatus = (payload: DrawOfferStatusPayload) => {
          if (payload.status === "pending") {
            setIsDrawOfferPending(true);
            setStatusNote("Draw offer sent. Waiting for opponent response.");
            return;
          }

          setIsDrawOfferPending(false);
          setStatusNote(`@${opponent?.username ?? "Opponent"} declined the draw offer.`);
        };

        wsService.on("queue_status", handleQueueStatus);
        wsService.on("match_found", handleMatchFound);
        wsService.on("move_made", handleMoveMade);
        wsService.on("move_error", handleMoveError);
        wsService.on("matchmaking_error", handleMatchmakingError);
        wsService.on("game_over", handleGameOver);
        wsService.on("rematch_requested", handleRematchRequested);
        wsService.on("rematch_request_status", handleRematchResponse);
        wsService.on("rematch_response", handleRematchResponse);
        wsService.on("draw_offered", handleDrawOffered);
        wsService.on("draw_offer_status", handleDrawOfferStatus);
        wsService.on("user_left", handleUserLeft);
        wsService.resumeActiveGame();

        return () => {
          wsService.off("queue_status", handleQueueStatus);
          wsService.off("match_found", handleMatchFound);
          wsService.off("move_made", handleMoveMade);
          wsService.off("move_error", handleMoveError);
          wsService.off("matchmaking_error", handleMatchmakingError);
          wsService.off("game_over", handleGameOver);
          wsService.off("rematch_requested", handleRematchRequested);
          wsService.off("rematch_request_status", handleRematchResponse);
          wsService.off("rematch_response", handleRematchResponse);
          wsService.off("draw_offered", handleDrawOffered);
          wsService.off("draw_offer_status", handleDrawOfferStatus);
          wsService.off("user_left", handleUserLeft);
        };
      } catch (profileError) {
        console.error("Failed to initialize online mode:", profileError);
        if (!isDisposed) {
          setRealtimeError(profileError instanceof Error ? profileError.message : "Failed to connect to realtime matchmaking");
        }
      }
    };

    let cleanupListeners: (() => void) | undefined;

    void loadProfileAndSocket().then((cleanup) => {
      cleanupListeners = cleanup;
    });

    return () => {
      isDisposed = true;
      cleanupListeners?.();
      wsService.disconnect("online-game");
    };
  }, []);

  useEffect(() => {
    if (panelMode !== "quick" || selectedControlId !== "rapid-10-0") {
      setIsSearchingMatch(false);
    }
  }, [panelMode, selectedControlId]);

  const currentProfile = profile ?? {
    id: 0,
    playerNumber: "#--",
    username: "player",
    rating: 800,
    wins: 0,
    losses: 0,
    draws: 0,
  };

  const selectedControl =
    timeControls.find((control) => control.id === selectedControlId) ||
    timeControls.find((control) => control.id === "rapid-10-0") ||
    timeControls[0];
  const showQueueUnderConstruction = panelMode === "quick" && selectedControlId !== "rapid-10-0";
  const activeOpponentLabel = opponent ? `@${opponent.username}` : isSearchingMatch ? "Searching..." : panelMode === "quick" ? `${selectedControl.summary} Pool` : panelMode === "friend" ? "Private Match Room" : "Tournament Arena";
  const checkSquare = game.isCheck() ? findKingSquare(game, game.turn()) : null;
  const checkmateSquare = game.isCheckmate() ? findKingSquare(game, game.turn()) : null;

  const topPlayerCardClassName =
    "flex items-center justify-between gap-3 rounded-[1.5rem] border border-black/10 bg-white/75 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10";
  const bottomPlayerCardClassName =
    "flex items-center justify-between gap-3 rounded-[1.5rem] border border-black/10 bg-[#f5f5f5]/95 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10";

  useEffect(() => {
    if (!clockState?.isRunning || gameOverReason !== null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [clockState?.activeColor, clockState?.isRunning, clockState?.lastUpdatedAt, gameOverReason]);

  function resetRealtimeBoardState() {
    if (gameId) {
      wsService.leaveGame(gameId);
    }

    clearActiveOnlineMatch();
    if (routeGameId) {
      navigate("/online-game", { replace: true });
    }

    setGameId(null);
    setGame(new Chess());
    setPlayerColor("white");
    setOpponent(null);
    setMoveHistory([]);
    setLastMoveSquares([]);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setGameResult(null);
    setGameOverReason(null);
    setIsRematchRequestPending(false);
    setIncomingRematchOffer(null);
    setIsResignConfirmOpen(false);
    setIsDrawOfferPending(false);
    setIncomingDrawOffer(null);
    setIsResultModalDismissed(false);
    setClockState(null);
    setClockNow(Date.now());
    setRatingDelta(null);
    previousMoveCountRef.current = 0;
    suppressNextSoundRef.current = false;
  }

  function applyRealtimeState(nextState: ActiveGameState) {
    const nextGame = new Chess(nextState.fen);
    const nextMoveCount = nextState.moveHistory?.length || 0;

    if (suppressNextSoundRef.current) {
      suppressNextSoundRef.current = false;
    } else if (nextMoveCount > previousMoveCountRef.current) {
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
    setClockState(nextState.clock ?? null);
    setClockNow(nextState.clock?.lastUpdatedAt ?? Date.now());
  }

  function getDisplayedClock(color: "white" | "black") {
    if (!clockState) {
      return null;
    }

    const baseTime = color === "white" ? clockState.whiteTimeMs : clockState.blackTimeMs;
    if (!clockState.isRunning || clockState.activeColor !== color || gameOverReason !== null) {
      return Math.max(0, baseTime);
    }

    return Math.max(0, baseTime - (clockNow - clockState.lastUpdatedAt));
  }

  function formatClock(timeMs: number | null) {
    if (timeMs === null) {
      return "--:--";
    }

    const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const ownClockMs = getDisplayedClock(playerColor);
  const opponentClockMs = getDisplayedClock(playerColor === "white" ? "black" : "white");
  const activeClockColor = gameOverReason === null ? clockState?.activeColor ?? (game.turn() === "w" ? "white" : "black") : null;
  const ownClockActive = activeClockColor === playerColor;
  const opponentClockActive = activeClockColor === (playerColor === "white" ? "black" : "white");
  const clockDangerThresholdMs = selectedControlId === "rapid-10-0" ? 30_000 : 10_000;
  const ownClockDanger = ownClockMs !== null && ownClockMs <= clockDangerThresholdMs;
  const opponentClockDanger = opponentClockMs !== null && opponentClockMs <= clockDangerThresholdMs;
  const ownClockCardClass = ownClockDanger
    ? "border-rose-500/40 bg-rose-500/14 shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_18px_35px_rgba(244,63,94,0.16)] dark:border-rose-400/35 dark:bg-rose-400/12"
    : ownClockActive
    ? "border-emerald-500/30 bg-white/90 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_20px_38px_rgba(16,185,129,0.14)] dark:border-emerald-400/25 dark:bg-white/12"
    : "border-black/8 bg-white/30 opacity-55 saturate-50 dark:border-white/8 dark:bg-white/[0.03] dark:opacity-50";
  const opponentClockCardClass = opponentClockDanger
    ? "border-rose-500/40 bg-rose-500/14 shadow-[0_0_0_1px_rgba(244,63,94,0.08),0_18px_35px_rgba(244,63,94,0.16)] dark:border-rose-400/35 dark:bg-rose-400/12"
    : opponentClockActive
    ? "border-emerald-500/30 bg-white/90 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_20px_38px_rgba(16,185,129,0.14)] dark:border-emerald-400/25 dark:bg-white/12"
    : "border-black/8 bg-white/30 opacity-55 saturate-50 dark:border-white/8 dark:bg-white/[0.03] dark:opacity-50";

  function handlePieceClick(square: string) {
    if (!canInteractWithBoard) {
      return;
    }

    const piece = game.get(square as Square);

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    if (piece && piece.color === playerTurn) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setPossibleMoves(moves.map((move) => move.to));
      return;
    }

    if (selectedSquare && possibleMoves.includes(square)) {
      makeMove(selectedSquare, square);
    }
  }

  function makeMove(from: string, to: string) {
    if (!gameId || !canInteractWithBoard) {
      return;
    }

    const piece = game.get(from as Square);
    const needsPromotion =
      piece &&
      piece.type === "p" &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));

    setRealtimeError(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
    wsService.sendMove(gameId, {
      from,
      to,
      promotion: needsPromotion ? "q" : undefined,
    });
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!canInteractWithBoard) {
      return false;
    }

    try {
      const testGame = new Chess(game.fen());
      const piece = testGame.get(sourceSquare as Square);
      const needsPromotion =
        piece &&
        piece.type === "p" &&
        ((piece.color === "w" && targetSquare[1] === "8") || (piece.color === "b" && targetSquare[1] === "1"));

      const testMove = testGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: needsPromotion ? "q" : undefined,
      });

      if (testMove) {
        makeMove(sourceSquare, targetSquare);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  function queueAction() {
    if (panelMode === "quick") {
      if (selectedControlId === "rapid-10-0") {
        if (hasActiveMatch) {
          setStatusNote("Current rapid game is still active.");
          return;
        }

        if (!isSocketReady) {
          setRealtimeError("Realtime connection is still initializing.");
          return;
        }

        setStatusNote(null);
        setRealtimeError(null);

        if (isSearchingMatch) {
          wsService.cancelMatch();
          setIsSearchingMatch(false);
          return;
        }

        resetRealtimeBoardState();
        wsService.findMatch(selectedControlId);
        setIsSearchingMatch(true);
        return;
      }

      setStatusNote(
        `Очередь ${selectedControl.summary.toLowerCase()} пока оставили в статусе разработки, а активный сценарий сейчас собираем вокруг rapid.`
      );
      return;
    }

    if (panelMode === "friend") {
      setStatusNote("Приватные лобби в разработке!");
      return;
    }

    setStatusNote("Турнирный раздел в разработке!");
  }

  function startNextMatchSearch() {
    resetRealtimeBoardState();
    setStatusNote(null);
    setRealtimeError(null);
    wsService.findMatch(selectedControlId);
    setIsSearchingMatch(true);
  }

  function sendRematchRequest() {
    if (!gameId || isRematchRequestPending) {
      return;
    }

    setStatusNote("Rematch offer sent. Waiting for opponent response.");
    setRealtimeError(null);
    setIsRematchRequestPending(true);
    wsService.requestRematch(gameId);
  }

  function respondToRematch(accept: boolean) {
    if (!incomingRematchOffer) {
      return;
    }

    const { gameId: finishedGameId, requestedBy } = incomingRematchOffer;
    setIncomingRematchOffer(null);

    if (accept) {
      setStatusNote(`You accepted @${requestedBy.username}'s rematch offer.`);
    } else {
      setStatusNote(`You declined @${requestedBy.username}'s rematch offer.`);
    }

    wsService.respondToRematch(finishedGameId, accept);
  }

  function offerDraw() {
    if (!gameId || gameOverReason !== null || isDrawOfferPending || incomingDrawOffer) {
      return;
    }

    setRealtimeError(null);
    setIsDrawOfferPending(true);
    wsService.offerDraw(gameId);
  }

  function respondToDraw(accept: boolean) {
    if (!incomingDrawOffer) {
      return;
    }

    const activeGameId = incomingDrawOffer.gameId;
    setIncomingDrawOffer(null);

    if (accept) {
      setStatusNote("You accepted the draw offer.");
      wsService.acceptDraw(activeGameId);
      return;
    }

    setStatusNote("You declined the draw offer.");
    wsService.respondToDraw(activeGameId, false);
  }

  function confirmResign() {
    if (!gameId || gameOverReason !== null) {
      return;
    }

    setIsResignConfirmOpen(false);
    setRealtimeError(null);
    wsService.resign(gameId);
  }

  function dismissResultModal() {
    setIsResultModalDismissed(true);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-black/5 blur-[150px] dark:bg-white/5" />

      <AnimatePresence>
        {isResignConfirmOpen ? (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/38 px-4"
          >
            <motion.div
              initial={{ y: 24, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.985, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
                <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                  <Flag className="h-10 w-10" />
                </div>
                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">Сдаться?</h2>
                <p className="mb-6 text-black/60 dark:text-white/60">
                  Партия сразу завершится поражением. Это действие нельзя отменить.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsResignConfirmOpen(false)}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={confirmResign}
                    className="flex-1 rounded-xl bg-rose-600 py-3 font-semibold text-white transition-all hover:bg-rose-500"
                  >
                    Сдаться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {incomingDrawOffer ? (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/38 px-4"
          >
            <motion.div
              initial={{ y: 28, scale: 0.965, opacity: 0, filter: "blur(10px)" }}
              animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 18, scale: 0.985, opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl border border-white/45 bg-white/96 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1a1a]/94"
            >
              <button
                onClick={() => respondToDraw(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/65 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-white/15 dark:hover:text-white"
                aria-label="Закрыть предложение ничьей"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-black/10 bg-black/5 text-black/80 dark:border-white/10 dark:bg-white/10 dark:text-white/80">
                  <Handshake className="h-10 w-10" />
                </div>
                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">Предложение ничьей</h2>
                <p className="mb-6 text-black/60 dark:text-white/60">
                  Соперник предлагает закончить текущую партию вничью.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => respondToDraw(false)}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    Играть дальше
                  </button>
                  <button
                    onClick={() => respondToDraw(true)}
                    className="flex-1 rounded-xl bg-black py-3 font-semibold text-white transition-all hover:opacity-90 dark:bg-white dark:text-black"
                  >
                    Согласиться
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isResultModalOpen ? (
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
                onClick={dismissResultModal}
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
                  <Trophy className={`h-16 w-16 ${gameResult === "win" ? "text-yellow-500" : gameResult === "draw" ? "text-gray-500" : "text-red-500"}`} />
                </motion.div>

                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">
                  {gameResult === "win" ? "You won!" : gameResult === "draw" ? "It's a draw!" : "You lost"}
                </h2>

                <p className="mb-6 text-black/60 dark:text-white/60">
                  {gameResult === "win"
                    ? "The game ended in your favor. You can immediately look for a new opponent or offer a rematch."
                    : gameResult === "draw"
                    ? "The game ended in a draw. You can start a new search or offer a rematch to your opponent."
                    : "The game ended in a loss. You can immediately start a new search or try to get a rematch."}
                </p>

                {ratingDelta ? (
                  <div className="mb-6 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                    <p className="mb-1 text-sm text-black/60 dark:text-white/60">Online Elo</p>
                    <p className="text-2xl font-bold text-black dark:text-white">
                      {ratingDelta.after} Elo {ratingDelta.delta >= 0 ? `(+${ratingDelta.delta})` : `(${ratingDelta.delta})`}
                    </p>
                  </div>
                ) : null}

                <div className="mb-6 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                  <p className="mb-1 text-sm text-black/60 dark:text-white/60">Current Opponent</p>
                  <p className="text-2xl font-bold text-black dark:text-white">{opponent ? `@${opponent.username} · ${opponent.rating} Elo` : "Opponent"}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={startNextMatchSearch}
                    className="flex-1 rounded-xl bg-black py-3 font-semibold text-white transition-all hover:opacity-90 dark:bg-white dark:text-black"
                  >
                    Next Match
                  </button>
                  <button
                    onClick={sendRematchRequest}
                    disabled={isRematchRequestPending}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    {isRematchRequestPending ? "Rematch Sent" : "Offer Rematch"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {incomingRematchOffer ? (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/38 px-4"
          >
            <motion.div
              initial={{ y: 28, scale: 0.965, opacity: 0, filter: "blur(10px)" }}
              animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: 18, scale: 0.985, opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl border border-white/45 bg-white/96 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1a1a]/94"
            >
              <button
                onClick={() => respondToRematch(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/65 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:hover:bg-white/15 dark:hover:text-white"
                aria-label="Закрыть предложение реванша"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-black/10 bg-black/5 text-black/80 dark:border-white/10 dark:bg-white/10 dark:text-white/80"
                >
                  <RotateCcw className="h-10 w-10" />
                </motion.div>

                <h2 className="mb-2 text-3xl font-bold text-black dark:text-white">
                  Rematch Offer
                </h2>

                <p className="mb-6 text-black/60 dark:text-white/60">
                  @{incomingRematchOffer.requestedBy.username} is offering a rematch.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => respondToRematch(false)}
                    className="flex-1 rounded-xl bg-black/10 py-3 font-semibold text-black transition-all hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respondToRematch(true)}
                    className="flex-1 rounded-xl bg-black py-3 font-semibold text-white transition-all hover:opacity-90 dark:bg-white dark:text-black"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
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
              <span className="text-sm tracking-wide">Main Menu</span>
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
              <div className="space-y-3 md:space-y-4">
                <div className={topPlayerCardClassName}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-[#d9d9d9] text-black/75 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.26em] text-black/45 dark:text-white/45">{opponent ? "Opponent" : "Online Lobby"}</p>
                      <p className="mt-1 text-lg font-semibold text-black/85 dark:text-white/85">{activeOpponentLabel}</p>
                      {opponent ? (
                        <p className="mt-1 text-xs md:text-sm text-black/50 dark:text-white/50">{opponent.playerNumber}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-black/45 dark:text-white/45">{gameId ? "Elo" : "Mode"}</p>
                    <p className="mt-1 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">{gameId && opponent ? opponent.rating : panelMode === "quick" ? selectedControl.label : panelMode === "friend" ? "Invite" : "Live"}</p>
                  </div>
                </div>

                {showQueueUnderConstruction ? (
                  <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-black/5 p-4 shadow-[0_28px_65px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_52%),linear-gradient(135deg,rgba(0,0,0,0.02),transparent)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_52%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent)]" />
                    <div className="relative rounded-[1.6rem] border border-dashed border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-white/60 to-black/[0.03] p-8 text-center dark:border-amber-400/25 dark:from-amber-400/8 dark:via-white/[0.04] dark:to-white/[0.02] md:p-10">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="mb-6 inline-block"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 dark:from-amber-400/10 dark:to-orange-400/10 md:h-24 md:w-24">
                          <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400 md:h-12 md:w-12" />
                        </div>
                      </motion.div>

                      <div className="mb-6 inline-block rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-2 dark:border-amber-400/30 dark:bg-amber-400/10">
                        <span className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                          <Zap className="h-4 w-4" />
                          Режим в разработке
                        </span>
                      </div>

                      <h2 className="text-2xl font-light tracking-tight text-black dark:text-white md:text-4xl">
                        {selectedControl.summary} not released yet
                      </h2>
                      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-black/60 dark:text-white/60 md:text-base">
                       На данный момент доступен только режим Rapid. Для {selectedControl.summary.toLowerCase()} ещё вернёмся отдельно, когда подготовим реальный матчмейкинг и очередь.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <CustomChessboard
                      position={game.fen()}
                      onPieceDrop={onDrop}
                      onSquareClick={handlePieceClick}
                      selectedSquare={selectedSquare}
                      possibleMoves={possibleMoves}
                      lastMoveSquares={lastMoveSquares}
                      checkSquare={checkSquare}
                      checkmateSquare={checkmateSquare}
                      boardOrientation={playerColor}
                      disabled={!canInteractWithBoard}
                    />
                    {isSearchingMatch ? (
                      <div className="absolute inset-0 flex items-center justify-center px-4 md:px-6 pointer-events-none">
                        <div className="rounded-3xl border border-black/10 bg-white/80 px-6 py-5 text-center shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-black/45">
                          <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity }}
                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                          >
                            <Bolt className="h-8 w-8 text-black/70 dark:text-white/70" />
                          </motion.div>
                          <p className="mt-3 text-xl md:text-2xl font-light text-black/85 dark:text-white/85">Searching For Opponent</p>
                          <p className="mt-2 text-xs md:text-sm text-black/50 dark:text-white/50">
                            Rapid queue is now active. This overlay will disappear as soon as a real opponent is found.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

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
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-4 md:space-y-5"
            >
              {isQueuePanelVisible ? (
                <div className="rounded-[1.75rem] border border-black/10 bg-black/5 p-5 md:p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Online Match</p>
                      <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight">Choose Queue</h1>
                    </div>
                    <div className={`rounded-2xl border border-black/10 bg-gradient-to-br ${selectedControl.accent} px-4 py-3 text-right dark:border-white/10`}>
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Active Mode</p>
                      <p className="mt-2 text-2xl font-light text-black/85 dark:text-white/85">{panelMode === "quick" ? selectedControl.label : panelMode === "friend" ? "Room" : "Arena"}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2.5">
                    {panelModes.map((mode) => {
                      const Icon = mode.icon;
                      const isActive = panelMode === mode.id;

                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            if (queueControlsLocked) {
                              return;
                            }
                            setPanelMode(mode.id);
                            setStatusNote(null);
                          }}
                          disabled={queueControlsLocked}
                          className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                            isActive
                              ? "border-black/25 bg-white/80 shadow-lg dark:border-white/25 dark:bg-white/10"
                              : "border-black/10 bg-white/45 hover:border-black/20 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                          } ${queueControlsLocked ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <Icon className="h-4 w-4 text-black/70 dark:text-white/70" />
                          <p className="mt-3 text-xs font-medium text-black/85 dark:text-white/85">{mode.label}</p>
                        </button>
                      );
                    })}
                  </div>

                  <motion.div
                    key={`${panelMode}-${selectedControlId}`}
                    initial={{ opacity: 0.72, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="mt-4 rounded-[1.5rem] border border-black/10 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
                  >
                    {panelMode === "quick" ? (
                      <>
                        <div className={`rounded-[1.35rem] border border-black/10 bg-gradient-to-br ${selectedControl.accent} p-4 dark:border-white/10`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Matchmaking</p>
                              <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">{selectedControl.summary} Queue</p>
                            </div>
                            <div className="shrink-0 rounded-2xl border border-black/10 bg-white/55 px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-black/20">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Time Control</p>
                              <p className="mt-1 text-lg font-light text-black/85 dark:text-white/85">{selectedControl.label}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {timeControls.map((control) => (
                            <button
                              key={control.id}
                              onClick={() => {
                                setSelectedControlId(control.id);
                                setStatusNote(null);
                              }}
                              disabled={queueControlsLocked}
                              className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                                selectedControlId === control.id
                                  ? "border-black/25 bg-white/85 shadow-lg dark:border-white/25 dark:bg-white/10"
                                  : "border-black/10 bg-white/45 hover:border-black/20 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                              } ${queueControlsLocked ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-black/85 dark:text-white/85">{control.label}</span>
                                <Clock3 className="h-4 w-4 text-black/45 dark:text-white/45" />
                              </div>
                              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{control.summary}</p>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : panelMode === "friend" ? (
                      <>
                        <div className="rounded-[1.35rem] border border-black/10 bg-gradient-to-br from-[#9ec5ff]/88 to-[#9ec5ff]/20 p-4 dark:border-white/10">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Private Lobby</p>
                              <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">Invite a Friend</p>
                            </div>
                            <div className="shrink-0 rounded-2xl border border-black/10 bg-white/55 px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-black/20">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Preview Code</p>
                              <p className="mt-1 text-lg font-light text-black/85 dark:text-white/85">ROOM</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {[
                            { title: "Create Room" },
                            { title: "Enter Code" },
                          ].map((item) => (
                            <div key={item.title} className="rounded-2xl border border-black/10 bg-white/45 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                              <p className="text-sm font-semibold text-black/85 dark:text-white/85">{item.title}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-[1.35rem] border border-black/10 bg-gradient-to-br from-[#f4cf6a]/88 to-[#f4cf6a]/20 p-4 dark:border-white/10">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Tournament Lobby</p>
                              <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">Daily Arenas</p>
                            </div>
                            <div className="shrink-0 rounded-2xl border border-black/10 bg-white/55 px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-black/20">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Format</p>
                              <p className="mt-1 text-lg font-light text-black/85 dark:text-white/85">Arena</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                          {[
                            { title: "Blitz Sprint" },
                            { title: "Rapid Night Cup" },
                          ].map((event) => (
                            <div key={event.title} className="rounded-2xl border border-black/10 bg-white/45 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-black/85 dark:text-white/85">{event.title}</p>
                                </div>
                                <Trophy className="h-5 w-5 text-black/45 dark:text-white/45" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>

                  <button
                    onClick={queueAction}
                    disabled={hasActiveMatch}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-black/20 bg-black px-5 py-3.5 text-sm font-medium text-white transition-all hover:opacity-90 dark:border-white/20 dark:bg-white dark:text-black"
                  >
                    {panelMode === "quick" ? <Bolt className="h-4 w-4" /> : panelMode === "friend" ? <Users className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                    {panelMode === "quick"
                      ? hasActiveMatch
                        ? "Match In Progress"
                        : isSearchingMatch && selectedControlId === "rapid-10-0"
                        ? "Cancel Search"
                        : gameOverReason
                        ? "Find Another Match"
                        : "Find Match"
                      : panelMode === "friend"
                      ? "Open Private Lobby"
                      : "Open Tournament Hub"}
                  </button>
                </div>
              ) : null}

              {gameId ? (
                <div className="rounded-[1.75rem] border border-black/10 bg-black/5 p-5 md:p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Live Match</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-black/10 bg-white/45 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">Turn</p>
                      <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">{game.turn() === playerTurn ? "Your move" : "Opponent move"}</p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white/45 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">Status</p>
                      <p className="mt-2 text-lg font-medium text-black/85 dark:text-white/85">{gameOverReason ? (gameResult === "win" ? "Victory" : gameResult === "loss" ? "Defeat" : "Draw") : "Playing"}</p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-4 transition-all duration-300 ${ownClockCardClass}`}>
                      <p className={`text-[11px] uppercase tracking-[0.18em] ${ownClockDanger ? "text-rose-700/80 dark:text-rose-300/80" : ownClockActive ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-black/35 dark:text-white/35"}`}>Your Clock</p>
                      <p className={`mt-2 text-lg font-medium ${ownClockDanger ? "text-rose-700 dark:text-rose-300" : ownClockActive ? "text-black dark:text-white" : "text-black/55 dark:text-white/55"}`}>{formatClock(ownClockMs)}</p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-4 transition-all duration-300 ${opponentClockCardClass}`}>
                      <p className={`text-[11px] uppercase tracking-[0.18em] ${opponentClockDanger ? "text-rose-700/80 dark:text-rose-300/80" : opponentClockActive ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-black/35 dark:text-white/35"}`}>Opponent Clock</p>
                      <p className={`mt-2 text-lg font-medium ${opponentClockDanger ? "text-rose-700 dark:text-rose-300" : opponentClockActive ? "text-black dark:text-white" : "text-black/55 dark:text-white/55"}`}>{formatClock(opponentClockMs)}</p>
                    </div>
                  </div>

                  {hasActiveMatch ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        onClick={offerDraw}
                        disabled={isDrawOfferPending || Boolean(incomingDrawOffer)}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/65 px-4 py-3 text-sm font-medium text-black/80 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15"
                      >
                        <Handshake className="h-4 w-4" />
                        {isDrawOfferPending ? "Draw Offered" : "Offer Draw"}
                      </button>
                      <button
                        onClick={() => setIsResignConfirmOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 transition-all hover:bg-rose-500/15 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/15"
                      >
                        <Flag className="h-4 w-4" />
                        Resign
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[1.4rem] border border-black/10 bg-white/45 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Move History</p>
                    {moveHistory.length ? (
                      <div className="mt-3 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1">
                        {moveHistory.map((move, index) => (
                          <div key={`${move}-${index}`} className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-black/75 dark:border-white/10 dark:bg-black/20 dark:text-white/75">
                            {index + 1}. {move}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-black/55 dark:text-white/55">Moves will appear here as soon as the game starts.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {statusNote ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
                  {statusNote}
                </div>
              ) : null}

              {realtimeError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                  {realtimeError}
                </div>
              ) : null}

              {!isSocketReady ? (
                <div className="rounded-2xl border border-black/10 bg-white/45 p-4 text-sm text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Establishing realtime connection to matchmaking server...
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}