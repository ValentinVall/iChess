import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Apple } from "lucide-react";
import { apiClient } from "../../lib/api";

export function SignIn() {
  const navigate = useNavigate();

  const handleSignIn = async () => {
    // For MVP: Use mock token - replace with real Apple auth later
    const mockToken = 'mock_jwt_token_' + Date.now();
    await apiClient.setToken(mockToken);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-black/5 dark:bg-white/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-12"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-black/10 to-black/5 dark:from-white/10 dark:to-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl mb-8">
            <svg viewBox="0 0 48 48" className="w-12 h-12">
              <path
                d="M24 6v16M24 26v16M16 14h16M16 34h16M14 24h20M12 18h24M12 30h24"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                className="text-black dark:text-white"
              />
            </svg>
          </div>
          
          <h1 className="text-5xl tracking-tight mb-3 font-light text-black dark:text-white">
            iChess
          </h1>
          
          <p className="text-black/40 dark:text-white/40 tracking-wide text-sm font-light">
            Play Chess Against AI
          </p>
        </motion.div>

        {/* Sign In Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          onClick={handleSignIn}
          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-black/10 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15 backdrop-blur-xl border border-black/20 dark:border-white/20 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
        >
          <Apple className="w-5 h-5" />
          <span className="text-sm tracking-wide">Sign in with Apple</span>
        </motion.button>

        {/* Footer text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 text-black/30 dark:text-white/30 text-xs tracking-wide"
        >
          Designed for iOS and macOS
        </motion.p>
      </motion.div>
    </div>
  );
}