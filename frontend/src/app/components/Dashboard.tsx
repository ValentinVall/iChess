import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Cpu, Globe, History, User, Settings } from "lucide-react";
import { BrandHomeLink } from "./BrandHomeLink";

export function Dashboard() {
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: Cpu,
      title: "Play AI",
      description: "Choose a level and challenge the AI",
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
          className="px-6 py-5 md:px-8 md:py-6 flex items-center justify-between"
        >
          <BrandHomeLink />
          
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
        <div className="max-w-5xl mx-auto px-6 py-10 md:px-8 md:py-14 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-10 md:mb-12 lg:mb-14"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight mb-3 md:mb-4 font-light">
              Welcome back
            </h1>
            <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
              Build your Elo and choose your next challenge
            </p>
          </motion.div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-3xl mx-auto">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                onClick={item.action}
                className="group relative p-6 md:p-7 rounded-3xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 backdrop-blur-xl border border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 transition-all duration-300 text-left hover:scale-[1.02] shadow-lg hover:shadow-2xl"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center group-hover:bg-black/15 dark:group-hover:bg-white/15 transition-all">
                    <item.icon className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                </div>
                
                <h3 className="text-xl md:text-2xl tracking-tight mb-2 font-light">
                  {item.title}
                </h3>
                <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
                  {item.description}
                </p>

                {/* Subtle arrow indicator */}
                <div className="absolute bottom-6 right-6 md:bottom-7 md:right-7 w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all">
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