import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed left-4 top-20 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/10 shadow-lg backdrop-blur-xl transition-all hover:bg-white/20 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 md:left-6 md:top-[5.5rem] lg:left-8"
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
