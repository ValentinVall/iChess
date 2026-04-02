import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, Home, Zap } from "lucide-react";
import { motion } from "motion/react";

export function OnlineGame() {
  const navigate = useNavigate();

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
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="bg-gradient-to-br from-black/5 to-black/2 dark:from-white/10 dark:to-white/5 border-2 border-dashed border-black/10 dark:border-white/10 p-12 text-center rounded-3xl">
            {/* Icon */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mb-8 inline-block"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 dark:from-amber-400/10 dark:to-orange-400/10 flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-400" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-light tracking-tight text-black dark:text-white mb-3"
            >
              Режим Online Match
            </motion.h1>

            {/* Status Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block mb-6"
            >
              <div className="px-4 py-2 rounded-full bg-amber-500/15 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30">
                <span className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2 font-medium">
                  <Zap className="w-4 h-4" />
                  Временно недоступен
                </span>
              </div>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-black/70 dark:text-white/70 leading-relaxed mb-8"
            >
              Режим онлайн-игры находится в стадии разработки и тестирования. 
              Мы как можно скорее добавим возможность играть с другими игроками.
            </motion.p>

            {/* Features Coming Soon */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-12"
            >
              <p className="text-sm text-black/50 dark:text-white/50 mb-4 uppercase tracking-wide">
                Что мы готовим:
              </p>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {["🎮 Поиск противника", "💬 Чат в игре", "🏆 Рейтинг", "⏱️ Временные контроли"].map(
                  (feature, index) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="px-4 py-3 rounded-xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5 text-sm text-black/60 dark:text-white/60"
                    >
                      {feature}
                    </motion.div>
                  )
                )}
              </div>
            </motion.div>

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full md:w-auto px-8 py-3 bg-black/80 dark:bg-white/10 hover:bg-black/90 dark:hover:bg-white/20 text-white dark:text-white rounded-xl border border-black/20 dark:border-white/20 transition-all text-lg font-medium tracking-wide"
              >
                ← Вернуться на главное меню
              </Button>
            </motion.div>
          </Card>

          {/* Decorative Elements */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-black/30 dark:text-white/30">
              Следите за обновлениями...
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}