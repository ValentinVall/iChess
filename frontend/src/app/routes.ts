import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { SignIn } from "./components/SignIn";
import { Dashboard } from "./components/Dashboard";
import { AIGame } from "./components/AIGame";
import { OnlineGame } from "./components/OnlineGame";
import { GameHistory } from "./components/GameHistory";
import { Profile } from "./components/Profile";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: SignIn },
      { path: "dashboard", Component: Dashboard },
      { path: "ai-game", Component: AIGame },
      { path: "online-game", Component: OnlineGame },
      { path: "game-history", Component: GameHistory },
      { path: "profile", Component: Profile },
      { path: "settings", Component: Settings },
    ],
  },
]);
