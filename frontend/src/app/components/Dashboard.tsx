import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Cpu, Globe, History, User, Crown, Settings } from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: Cpu,
      title: "Play AI",
      description: "Challenge the engine",
      action: () => navigate("/ai-game"),
    },
    {
      icon: Globe,
      title: "Online Match",
      description: "Find an opponent",
      action: () => navigate("/online-game"),
    },
    {
      icon: History,
      title: "Game History",
      description: "Review your games",
      action: () => navigate("/game-history"),
    },
    {
      icon: User,
      title: "Profile",
      description: "View statistics",
      action: () => navigate("/profile"),
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-black/5 dark:bg-white/5 rounded-full blur-[150px]" />

      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="px-8 py-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <span className="text-lg tracking-tight font-light">iChess</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/settings")}
              className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/15 dark:hover:bg-white/15 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-black/15 dark:hover:bg-white/15 transition-all"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </motion.header>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-20"
          >
            <h1 className="text-6xl tracking-tight mb-4 font-light">
              Welcome back
            </h1>
            <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
              Choose your game mode
            </p>
          </motion.div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                onClick={item.action}
                className="group relative p-8 rounded-3xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 backdrop-blur-xl border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 transition-all duration-300 text-left hover:scale-[1.02] shadow-lg hover:shadow-2xl"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center group-hover:bg-black/15 dark:group-hover:bg-white/15 transition-all">
                    <item.icon className="w-7 h-7" />
                  </div>
                </div>
                
                <h3 className="text-2xl tracking-tight mb-2 font-light">
                  {item.title}
                </h3>
                <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
                  {item.description}
                </p>

                {/* Subtle arrow indicator */}
                <div className="absolute bottom-8 right-8 w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                    <path d="M3 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}