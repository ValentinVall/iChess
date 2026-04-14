import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell, Swords, Users } from "lucide-react";
import { apiClient } from "../../lib/api";
import { wsService } from "../../lib/socket";
import {
  clearActiveOnlineMatch,
  getActiveOnlineMatch,
  getActiveOnlineMatchStorageEventName,
} from "../activeOnlineMatch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type NotificationItem =
  | {
      id: string;
      type: "friend-request";
      title: string;
      description: string;
      actionLabel: string;
      actionPath: string;
    }
  | {
      id: string;
      type: "active-match";
      title: string;
      description: string;
      actionLabel: string;
      actionPath: string;
    };

interface FriendRequestNotificationPayload {
  friendshipId: string | null;
  requestedBy: {
    userId: number;
    username: string;
    playerNumber: string | null;
  };
}

export function NotificationsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let isDisposed = false;

    async function loadNotifications() {
      const token = await apiClient.getToken();
      if (!token) {
        if (!isDisposed) {
          setHasSession(false);
          setSessionUserId(null);
          setNotifications([]);
        }
        wsService.disconnect("notifications");
        return;
      }

      setIsLoading(true);

      try {
        const session = await apiClient.verifySession();
        if (!session.valid) {
          if (!isDisposed) {
            setHasSession(false);
            setSessionUserId(null);
            setNotifications([]);
          }
          wsService.disconnect("notifications");
          return;
        }

        await wsService.connect(token, "notifications");

        const [friendsOverview] = await Promise.all([
          apiClient.getFriendsOverview(),
        ]);

        const nextNotifications: NotificationItem[] = friendsOverview.incomingRequests.map((item) => ({
          id: `friend-request-${item.friendshipId}`,
          type: "friend-request",
          title: "New friend request",
          description: `@${item.username} sent you a friend request.`,
          actionLabel: "Open friends",
          actionPath: "/friends",
        }));

        const activeMatch = getActiveOnlineMatch();
        const isViewingOnlineGame = location.pathname.startsWith("/online-game") || location.pathname.startsWith("/game/live/");
        if (activeMatch && activeMatch.ownerId === session.userId && !isViewingOnlineGame) {
          nextNotifications.unshift({
            id: `active-match-${activeMatch.gameId}`,
            type: "active-match",
            title: "Rejoin active match",
            description: `Your online game against @${activeMatch.opponentUsername} is still active.`,
            actionLabel: "Rejoin match",
            actionPath: `/game/live/${activeMatch.gameId}`,
          });
        }

        if (!isDisposed) {
          setHasSession(true);
          setSessionUserId(session.userId);
          setNotifications(nextNotifications);
        }
      } catch {
        if (!isDisposed) {
          setHasSession(true);
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);

    const handleFocus = () => {
      void loadNotifications();
    };

    const handleStorageRefresh = () => {
      void loadNotifications();
    };

    const handleFriendRequestReceived = (payload: FriendRequestNotificationPayload) => {
      setNotifications((current) => {
        const notificationId = `friend-request-${payload.friendshipId ?? payload.requestedBy.userId}`;
        if (current.some((item) => item.id === notificationId)) {
          return current;
        }

        return [
          {
            id: notificationId,
            type: "friend-request",
            title: "New friend request",
            description: `@${payload.requestedBy.username} sent you a friend request.`,
            actionLabel: "Open friends",
            actionPath: "/friends",
          },
          ...current,
        ];
      });
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageRefresh);
    window.addEventListener(getActiveOnlineMatchStorageEventName(), handleStorageRefresh);
    wsService.on("friend_request_received", handleFriendRequestReceived);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageRefresh);
      window.removeEventListener(getActiveOnlineMatchStorageEventName(), handleStorageRefresh);
      wsService.off("friend_request_received", handleFriendRequestReceived);
      wsService.disconnect("notifications");
    };
  }, [location.pathname]);

  if (!hasSession) {
    return null;
  }

  const unreadCount = notifications.length;

  function handleNotificationAction(item: NotificationItem) {
    if (item.type === "active-match") {
      clearActiveOnlineMatch();
    }

    setIsOpen(false);
    navigate(item.actionPath);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-4 top-34 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/10 shadow-lg backdrop-blur-xl transition-all hover:bg-white/20 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 md:left-6 md:top-[8.75rem] lg:left-8"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5 text-black dark:text-white" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-black/10 bg-white/96 sm:max-w-lg dark:border-white/10 dark:bg-[#161616]/96">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">Notifications</DialogTitle>
            <DialogDescription className="text-black/55 dark:text-white/55">
              Friend requests and active-match reminders appear here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {isLoading ? <p className="text-sm text-black/50 dark:text-white/50">Loading notifications...</p> : null}

            {!isLoading && notifications.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-5 text-sm text-black/55 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                No notifications yet.
              </div>
            ) : null}

            {notifications.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-black/10 bg-black/5 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/10">
                    {item.type === "friend-request" ? (
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Swords className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black/85 dark:text-white/85">{item.title}</p>
                    <p className="mt-1 text-sm text-black/55 dark:text-white/55">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationAction(item)}
                  className="shrink-0 rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-700 transition-all hover:bg-blue-500/20 dark:text-blue-300"
                >
                  {item.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}