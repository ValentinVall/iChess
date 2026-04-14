export interface ActiveOnlineMatchSummary {
  ownerId: string;
  gameId: string;
  opponentUsername: string;
  playerColor: "white" | "black";
  updatedAt: string;
}

const ACTIVE_ONLINE_MATCH_KEY = "ichess-active-online-match";
const ACTIVE_ONLINE_MATCH_EVENT = "ichess-active-online-match-updated";

function emitActiveOnlineMatchUpdate() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACTIVE_ONLINE_MATCH_EVENT));
}

export function getActiveOnlineMatchStorageEventName() {
  return ACTIVE_ONLINE_MATCH_EVENT;
}

export function getActiveOnlineMatch() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(ACTIVE_ONLINE_MATCH_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as ActiveOnlineMatchSummary;
    if (
      typeof parsed.ownerId === "string" &&
      typeof parsed.gameId === "string" &&
      typeof parsed.opponentUsername === "string" &&
      (parsed.playerColor === "white" || parsed.playerColor === "black") &&
      typeof parsed.updatedAt === "string"
    ) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(ACTIVE_ONLINE_MATCH_KEY);
  }

  return null;
}

export function saveActiveOnlineMatch(summary: ActiveOnlineMatchSummary) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_ONLINE_MATCH_KEY, JSON.stringify(summary));
  emitActiveOnlineMatchUpdate();
}

export function clearActiveOnlineMatch() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_ONLINE_MATCH_KEY);
  emitActiveOnlineMatchUpdate();
}