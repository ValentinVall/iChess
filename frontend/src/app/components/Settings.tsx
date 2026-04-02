import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, Volume2, VolumeX, Palette, Zap, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

export function Settings() {
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("soundEnabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("notificationsEnabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [pieceStyle, setPieceStyle] = useState(() => {
    return localStorage.getItem("pieceStyle") || "default";
  });
  const [boardTheme, setBoardTheme] = useState(() => {
    return localStorage.getItem("boardTheme") || "light";
  });

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("soundEnabled", JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("notificationsEnabled", JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("pieceStyle", pieceStyle);
  }, [pieceStyle]);

  useEffect(() => {
    localStorage.setItem("boardTheme", boardTheme);
  }, [boardTheme]);

  const pieceStyles = [
    { id: "default", name: "Classic", description: "Standard chess pieces" },
    { id: "modern", name: "Modern", description: "Minimalist design" },
    { id: "fantasy", name: "Fantasy", description: "Unique style" },
  ];

  const themes = [
    { id: "light", name: "Light", colors: "bg-gradient-to-br from-gray-50 to-gray-100" },
    { id: "dark", name: "Dark", colors: "bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]" },
    { id: "ocean", name: "Ocean", colors: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900" },
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
          <h1 className="text-lg font-light tracking-tight">Settings</h1>
          <div className="w-9" />
        </motion.header>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Audio Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <Card className="bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-black/60 dark:text-white/60" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-black/60 dark:text-white/60" />
                  )}
                  <div>
                    <h3 className="font-light text-sm tracking-wide">Sound Effects</h3>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                      Play sounds for moves and captures
                    </p>
                  </div>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <Card className="bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-black/60 dark:text-white/60" />
                  <div>
                    <h3 className="font-light text-sm tracking-wide">Notifications</h3>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                      Get notified on game updates
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
            </Card>
          </motion.div>

          {/* Piece Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <div className="mb-4">
              <h3 className="text-sm font-light tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4" /> Piece Style
              </h3>
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                Choose your preferred chess piece design
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pieceStyles.map((style) => (
                <motion.button
                  key={style.id}
                  onClick={() => setPieceStyle(style.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    pieceStyle === style.id
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                      : "border-black/10 dark:border-white/10 bg-white/30 dark:bg-white/5 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  <p className="font-light text-sm tracking-wide">{style.name}</p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                    {style.description}
                  </p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Board Theme */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8"
          >
            <div className="mb-4">
              <h3 className="text-sm font-light tracking-wide flex items-center gap-2">
                <Palette className="w-4 h-4" /> Board Theme
              </h3>
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                Select your preferred board appearance
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themes.map((theme) => (
                <motion.button
                  key={theme.id}
                  onClick={() => setBoardTheme(theme.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    boardTheme === theme.id
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                      : "border-black/10 dark:border-white/10 bg-white/30 dark:bg-white/5 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  <div className={`w-full h-8 rounded-lg mb-3 ${theme.colors}`} />
                  <p className="font-light text-sm tracking-wide">{theme.name}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex gap-4 justify-center pt-8"
          >
            <Button
              onClick={() => navigate("/dashboard")}
              className="px-8 py-2 rounded-lg bg-black/10 hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15 transition-all"
            >
              Done
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
