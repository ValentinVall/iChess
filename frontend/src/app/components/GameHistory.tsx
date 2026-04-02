import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Home, Trophy, X } from "lucide-react";
import { motion } from "motion/react";
import { apiClient } from "../../lib/api";

interface Game {
  id: string;
  mode: string;
  result: string;
  difficulty: number;
  date: string;
  duration: number;
  pgn: string;
}

export function GameHistory() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await apiClient.getGameHistory();
        setGames(data.games || []);
      } catch (error) {
        console.error('Failed to load game history:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 px-8 py-6 flex items-center"
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="text-sm tracking-wide">На главное меню</span>
        </button>
      </motion.header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl tracking-tight font-light">Game History</h1>
            <p className="text-black/40 dark:text-white/40 text-sm mt-2">Review your past games</p>
          </motion.div>

          {loading ? (
            <div className="text-center text-black/60 dark:text-white/60">Loading...</div>
          ) : games.length === 0 ? (
            <Card className="bg-gradient-to-br from-black/5 to-black/2 dark:from-white/10 dark:to-white/5 border border-black/10 dark:border-white/10 p-12 text-center rounded-2xl">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-black/20 dark:text-white/20" />
              <h2 className="text-2xl font-light mb-2">No games yet</h2>
              <p className="text-black/40 dark:text-white/40 mb-6">Play a game to see your history here</p>
              <Button onClick={() => navigate("/ai-game")}>Play Now</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {games.map((game) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center">
                          <span className={`text-lg font-bold ${
                            game.result === 'win' ? 'text-green-600 dark:text-green-400' :
                            game.result === 'draw' ? 'text-gray-600 dark:text-gray-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {game.result === 'win' ? '✓' : game.result === 'draw' ? '=' : '✗'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-light capitalize">
                            {game.result === 'win' ? 'Victory' : game.result === 'draw' ? 'Draw' : 'Loss'}
                          </h3>
                          <p className="text-xs text-black/40 dark:text-white/40">
                            Difficulty: Level {game.difficulty} · {new Date(game.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-light">vs AI</p>
                        <p className="text-xs text-black/40 dark:text-white/40">{Math.floor(game.duration)}s</p>
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
