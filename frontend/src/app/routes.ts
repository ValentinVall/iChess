import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { SignIn } from "./components/SignIn";
import { Dashboard } from "./components/Dashboard";
import { AIGame } from "./components/AIGame";
import { OnlineGame } from "./components/OnlineGame";
import { GameHistory } from "./components/GameHistory";
import { Friends } from "./components/Friends";
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
      { path: "ai-game/:gameId", Component: AIGame },
      { path: "online-game", Component: OnlineGame },
      { path: "online-game/:gameId", Component: OnlineGame },
      { path: "game/ai/:gameId", Component: AIGame },
      { path: "game/live/:gameId", Component: OnlineGame },
      { path: "game-history", Component: GameHistory },
      { path: "friends", Component: Friends },
      { path: "profile", Component: Profile },
      { path: "profile/:playerNumber", Component: Profile },
      { path: "settings", Component: Settings },
    ],
  },
]);
