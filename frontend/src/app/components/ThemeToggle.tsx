import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-white/20 dark:hover:bg-white/15 transition-all shadow-lg"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 text-black dark:text-white" />
      ) : (
        <Sun className="w-5 h-5 text-black dark:text-white" />
      )}
    </button>
  );
}
