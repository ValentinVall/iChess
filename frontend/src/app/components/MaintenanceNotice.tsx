import { Card } from "./ui/card";
import { AlertCircle, Clock3, ShieldAlert, Wrench, Zap } from "lucide-react";
import { motion } from "motion/react";

interface MaintenanceConfig {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  eta?: string;
}

export function MaintenanceNotice({ config }: { config: MaintenanceConfig }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />

      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="bg-gradient-to-br from-black/5 to-black/2 dark:from-white/10 dark:to-white/5 border-2 border-dashed border-black/10 dark:border-white/10 p-12 text-center rounded-3xl">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mb-8 inline-block"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 dark:from-amber-400/10 dark:to-orange-400/10 flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-400" />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-light tracking-tight text-black dark:text-white mb-3"
            >
              {config.title || "Технические работы на шахматной доске"}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block mb-6"
            >
              <div className="px-4 py-2 rounded-full bg-amber-500/15 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30">
                <span className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2 font-medium">
                  <motion.span
                    animate={{ rotate: [0, -8, 8, -6, 6, 0], x: [0, -1, 1, -1, 1, 0] }}
                    transition={{ duration: 0.55, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
                    className="flex items-center"
                  >
                    <Zap className="w-4 h-4" />
                  </motion.span>
                  Сервис временно недоступен
                </span>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-black/70 dark:text-white/70 leading-relaxed mb-8"
            >
              {config.subtitle || "Мы временно закрыли вход для новых посещений, пока наводим порядок в сервисе и готовим следующее обновление."}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-12"
            >
              <p className="text-sm text-black/50 dark:text-white/50 mb-4 uppercase tracking-wide">
                Что сейчас происходит:
              </p>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {[
                  { icon: Wrench, text: config.message || "Обновляем систему, проверяем стабильность и готовим сервис к безопасному возвращению игроков." },
                  { icon: Clock3, text: config.eta || "Вернемся сразу после завершения проверки. Обновите страницу чуть позже." },
                  { icon: ShieldAlert, text: "Пользователи, которые уже находятся на сайте, не будут принудительно отключены. Ограничение действует только для новых открытий и обновлений страницы." },
                ].map((item, index) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="px-4 py-4 rounded-xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5 text-sm text-black/60 dark:text-white/60 text-left flex items-start gap-3"
                  >
                    <item.icon className="w-5 h-5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </Card>

          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-black/30 dark:text-white/30">
              Шахматные часы временно остановлены. Как только техническая партия закончится, сервис снова станет доступен.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
