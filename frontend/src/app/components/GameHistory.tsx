import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Home, Trophy, Brain, Swords, CalendarDays, TimerReset, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { apiClient, type HistoryGame } from "../../lib/api";
import { DEFAULT_STOCKFISH_LEVEL, getStockfishLevelMeta } from "../stockfishLevels";
import { BrandHomeLink } from "./BrandHomeLink";

export function GameHistory() {
  const navigate = useNavigate();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await apiClient.getGameHistory();
        setGames(data.games || []);
      } catch (error) {
        console.error('Failed to load game history:', error);
        setError(error instanceof Error ? error.message : 'Failed to load game history');
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  function getOutcomeLabel(outcome: HistoryGame['outcome']) {
    if (outcome === 'win') return 'Victory';
    if (outcome === 'loss') return 'Loss';
    return 'Draw';
  }

  function getOutcomeTone(outcome: HistoryGame['outcome']) {
    if (outcome === 'win') {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }

    if (outcome === 'loss') {
      return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';
    }

    return 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
  }

  function formatDuration(durationInSeconds: number) {
    if (durationInSeconds < 60) {
      return `${durationInSeconds}s`;
    }

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-4 py-4 md:px-6 md:py-5 lg:px-8"
      >
        <BrandHomeLink />
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="text-sm tracking-wide">На главное меню</span>
        </button>
      </motion.header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 md:mb-8"
          >
            <h1 className="text-3xl tracking-tight font-light md:text-4xl">Game History</h1>
            <p className="text-black/40 dark:text-white/40 text-sm mt-2">Review your completed games, results, and opponents.</p>
          </motion.div>

          {loading ? (
            <div className="text-center text-black/60 dark:text-white/60">Loading...</div>
          ) : error ? (
            <Card className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-rose-500/5 p-8 text-center md:p-10">
              <h2 className="text-2xl font-light mb-2">Failed to load history</h2>
              <p className="text-black/50 dark:text-white/50 mb-6">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </Card>
          ) : games.length === 0 ? (
            <Card className="rounded-2xl border border-black/10 bg-gradient-to-br from-black/5 to-black/2 p-8 text-center dark:border-white/10 dark:from-white/10 dark:to-white/5 md:p-10">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-black/20 dark:text-white/20" />
              <h2 className="text-2xl font-light mb-2">No games yet</h2>
              <p className="text-black/40 dark:text-white/40 mb-6">Play a game to see your history here</p>
              <Button onClick={() => navigate("/ai-game")}>Play Now</Button>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {games.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  <Card className="rounded-3xl border border-black/10 bg-black/5 p-5 transition-all hover:border-black/20 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
                      <div className="flex min-w-0 items-start gap-4 flex-1">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border md:h-14 md:w-14 ${getOutcomeTone(game.outcome)}`}>
                          {game.mode === 'ai' ? <Brain className="h-6 w-6" /> : <Swords className="h-6 w-6" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-light md:text-xl">{getOutcomeLabel(game.outcome)}</h3>
                            <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getOutcomeTone(game.outcome)}`}>
                              {game.outcome}
                            </span>
                            <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-black/55 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                              {game.mode === 'ai' ? 'AI Match' : 'Online Match'}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-black/55 dark:text-white/55">
                            Opponent: <span className="text-black/75 dark:text-white/75">{game.opponentLabel}</span>
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/45 dark:text-white/45">
                            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 dark:border-white/10">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {new Date(game.date).toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 dark:border-white/10">
                              <TimerReset className="h-3.5 w-3.5" />
                              {formatDuration(game.duration)}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 dark:border-white/10">
                              <ChevronRight className="h-3.5 w-3.5" />
                              {game.mode === 'ai'
                                ? `${getStockfishLevelMeta(game.difficulty ?? DEFAULT_STOCKFISH_LEVEL).title} · ${getStockfishLevelMeta(game.difficulty ?? DEFAULT_STOCKFISH_LEVEL).elo} Elo`
                                : `Played as ${game.playerColor}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white/50 p-4 text-left md:w-64 dark:border-white/10 dark:bg-white/5">
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Stored Result</p>
                        <p className="mt-2 text-sm text-black/75 dark:text-white/75">
                          Board result: {game.result}
                        </p>
                        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
                          PGN {game.pgn ? 'saved' : 'not available yet'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
