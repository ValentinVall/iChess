import { Outlet } from "react-router";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

export function Root() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-black dark:text-white">
        <ThemeToggle />
        <Outlet />
      </div>
    </ThemeProvider>
  );
}