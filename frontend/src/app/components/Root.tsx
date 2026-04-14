import { Outlet } from "react-router";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsButton } from "./NotificationsButton";
import { SITE_VERSION } from "../siteVersion";

export function Root() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-black dark:text-white">
        <ThemeToggle />
        <NotificationsButton />
        <Outlet />
        <div
          title={`${SITE_VERSION.label} • ${SITE_VERSION.releasedAt}\n${SITE_VERSION.summary}`}
          className="fixed bottom-4 right-4 z-40 rounded-2xl border border-black/10 bg-white/78 px-3 py-2 text-right shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-black/45"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">Site Version</p>
          <p className="mt-1 text-sm font-medium text-black/80 dark:text-white/80">{SITE_VERSION.label}</p>
          <p className="text-[11px] text-black/45 dark:text-white/45">{SITE_VERSION.releasedAt}</p>
        </div>
      </div>
    </ThemeProvider>
  );
}