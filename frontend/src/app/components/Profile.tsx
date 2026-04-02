import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, Trophy, TrendingUp, Clock, Award, ArrowRight } from "lucide-react";
import { apiClient } from "../../lib/api";

interface UserProfile {
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  memberSince: string;
}

export function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await apiClient.getProfile();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="text-black/60 dark:text-white/60">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="text-black/60 dark:text-white/60">Failed to load profile</div>
      </div>
    );
  }

  const stats = [
    { label: "Rating", value: profile.rating, icon: Trophy },
    { label: "Wins", value: profile.wins, icon: Award },
    { label: "Games Played", value: profile.totalGames, icon: Clock },
    { label: "Win Rate", value: `${profile.winRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-[#0a0a0a] dark:via-[#121212] dark:to-[#0a0a0a]" />
      
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-black/5 dark:bg-white/5 rounded-full blur-[120px]" />

      <div className="relative z-10">
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
            <span className="text-sm tracking-wide">Back</span>
          </button>
        </motion.header>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-xl border border-black/20 dark:border-white/20 mb-6">
              <span className="text-4xl">{profile.displayName.charAt(0).toUpperCase()}</span>
            </div>
            
            <h1 className="text-4xl tracking-tight mb-2 font-light">
              {profile.displayName}
            </h1>
            <p className="text-black/40 dark:text-white/40 text-sm tracking-wide">
              Member since {new Date(profile.memberSince).toLocaleDateString()}
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                className="p-6 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-5 h-5 text-black/60 dark:text-white/60" />
                </div>
                <p className="text-3xl mb-1 font-light">{stat.value}</p>
                <p className="text-xs text-black/40 dark:text-white/40 tracking-wide">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* View Full History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <button
              onClick={() => navigate("/game-history")}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-500 dark:text-blue-400 hover:bg-blue-500/25 transition-all text-sm font-medium"
            >
              View Full Game History
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}