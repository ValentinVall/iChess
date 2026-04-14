const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE = env?.VITE_API_URL || 'http://localhost:3000/api';

export interface AuthUser {
  id: string;
  username: string;
  rating?: number;
}

export interface AuthSession {
  success: boolean;
  token: string;
  accessToken: string;
  refreshTokenExpiresAt?: string;
  user: AuthUser;
}

export interface RegistrationPreview {
  success: boolean;
  playerNumber: string;
  numericPlayerNumber: number;
}

export type OnlineRatingMode = 'bullet' | 'blitz' | 'rapid';
export type ProfileStatMode = OnlineRatingMode | 'ai';

export interface ModeStats {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
}

export interface UserProfileResponse {
  id: number;
  playerNumber: string | null;
  username: string;
  bio: string;
  isSystemAccount: boolean;
  accountLabel: string;
  accountNote: string;
  friendCount: number;
  isOwnProfile: boolean;
  selectedMode: ProfileStatMode;
  modeStats: Record<ProfileStatMode, ModeStats>;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  memberSince: string;
}

export interface HistoryGame {
  id: string;
  mode: string;
  outcome: 'win' | 'loss' | 'draw';
  result: 'white' | 'black' | 'draw';
  playerColor: 'white' | 'black';
  opponentLabel: string;
  opponentPlayerNumber?: string | null;
  difficulty: number | null;
  date: string;
  duration: number;
  pgn: string;
}

export interface FriendEntry {
  friendshipId: string;
  userId: number;
  username: string;
  playerNumber: string | null;
  bio: string;
  status: 'pending' | 'accepted';
  direction: 'accepted' | 'incoming' | 'outgoing';
}

export interface FriendsOverviewResponse {
  success: boolean;
  friendCount: number;
  friends: FriendEntry[];
  incomingRequests: FriendEntry[];
  outgoingRequests: FriendEntry[];
}

export interface FriendSearchResult {
  success: boolean;
  friendshipId: string | null;
  relationshipStatus: 'none' | 'friend' | 'outgoing_pending' | 'incoming_pending' | 'self';
  user: {
    userId: number;
    username: string;
    playerNumber: string | null;
    bio: string;
  };
}

export interface ActiveGameState {
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  result?: 'white' | 'black' | 'draw';
  moveHistory: string[];
  moves: Array<{ from: string; to: string; san: string }>;
  legalMoves: string[];
  clock?: {
    initialTimeMs: number;
    incrementMs: number;
    whiteTimeMs: number;
    blackTimeMs: number;
    activeColor: 'white' | 'black';
    lastUpdatedAt: number;
    isRunning: boolean;
  };
}

export interface GameMetadataResponse {
  id: string;
  status: string;
  mode: 'ai' | 'online';
  difficulty?: number;
  whitePlayerId: string;
  blackPlayerId?: string;
  timeControlId?: string;
}

export type PlayerColor = 'white' | 'black';

export const apiClient = {
  // Auth
  async getToken(): Promise<string | null> {
    return localStorage.getItem('authToken');
  },

  async setToken(token: string) {
    localStorage.setItem('authToken', token);
  },

  clearToken() {
    localStorage.removeItem('authToken');
  },

  async authenticate(path: 'login' | 'register', username: string, password: string): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({ error: `Failed to ${path}` }));

    if (!response.ok) {
      throw new Error(data.error || `Failed to ${path}`);
    }

    const token = data.token || data.accessToken;
    if (token) {
      await this.setToken(token);
    }

    return data as AuthSession;
  },

  async register(username: string, password: string) {
    return this.authenticate('register', username, password);
  },

  async getRegistrationPreview(): Promise<RegistrationPreview> {
    const response = await fetch(`${API_BASE}/auth/register-preview`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({ error: 'Failed to load registration preview' }));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load registration preview');
    }

    return data as RegistrationPreview;
  },

  async login(username: string, password: string) {
    return this.authenticate('login', username, password);
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.authorizedFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json().catch(() => ({ error: 'Failed to change password' }));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to change password');
    }

    return data as { success: boolean; message: string };
  },

  async refreshSession(): Promise<string | null> {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      this.clearToken();
      return null;
    }

    const token = data.token || data.accessToken;
    if (!token) {
      this.clearToken();
      return null;
    }

    await this.setToken(token);
    return token;
  },

  async verifySession() {
    const token = await this.getToken();

    if (!token) {
      const refreshedToken = await this.refreshSession();
      if (!refreshedToken) {
        return { valid: false };
      }
    }

    const response = await this.authorizedFetch(`${API_BASE}/auth/verify`, {
      method: 'GET',
    });

    const data = await response.json().catch(() => ({ valid: false }));

    if (!response.ok || !data.valid) {
      this.clearToken();
      return { valid: false };
    }

    return data as { valid: true; userId: string; authSubject: string };
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } finally {
      this.clearToken();
    }
  },

  async authorizedFetch(url: string, init: RequestInit = {}, allowRetry: boolean = true) {
    let token = await this.getToken();

    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && allowRetry) {
      const nextToken = await this.refreshSession();
      if (!nextToken) {
        return response;
      }

      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Authorization', `Bearer ${nextToken}`);

      return fetch(url, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
      });
    }

    return response;
  },

  // Games
  async createGame(difficulty: number = 3, playerColor: PlayerColor = 'white') {
    const response = await this.authorizedFetch(`${API_BASE}/games/vs-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ difficulty, playerColor }),
    });

    if (!response.ok) throw new Error('Failed to create game');
    return response.json();
  },

  async getGameState(gameId: string): Promise<{ metadata: GameMetadataResponse; state: ActiveGameState }> {
    const response = await this.authorizedFetch(`${API_BASE}/games/${gameId}`);

    if (!response.ok) throw new Error('Failed to get game state');
    return response.json();
  },

  async makeGameMove(gameId: string, move: { from: string; to: string; promotion?: string }) {
    const response = await this.authorizedFetch(`${API_BASE}/games/${gameId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ move }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to make move' }));
      throw new Error(error.error || 'Failed to make move');
    }

    return response.json();
  },

  async requestAIMove(gameId: string) {
    const response = await this.authorizedFetch(`${API_BASE}/games/${gameId}/ai-move`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get AI move' }));
      throw new Error(error.error || 'Failed to get AI move');
    }

    return response.json();
  },

  async resignGame(gameId: string) {
    const response = await this.authorizedFetch(`${API_BASE}/games/${gameId}/resign`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to resign game' }));
      throw new Error(error.error || 'Failed to resign game');
    }

    return response.json();
  },

  async finishGame(gameId: string, result: 'white' | 'black' | 'draw', pgn: string, finalFen: string) {
    const response = await this.authorizedFetch(`${API_BASE}/games/${gameId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ result, pgn, finalFen }),
    });

    if (!response.ok) throw new Error('Failed to finish game');
    return response.json();
  },

  // Users
  async getProfile(mode?: ProfileStatMode): Promise<UserProfileResponse> {
    const profileUrl = new URL(`${API_BASE}/users/me`);

    if (mode) {
      profileUrl.searchParams.set('mode', mode);
    }

    const response = await this.authorizedFetch(profileUrl.toString());

    if (!response.ok) throw new Error('Failed to get profile');
    return response.json();
  },

  async getPublicProfile(playerNumber: string, mode?: ProfileStatMode): Promise<UserProfileResponse> {
    const normalizedPlayerNumber = String(playerNumber).replace(/[^0-9]/g, '');
    const profileUrl = new URL(`${API_BASE}/users/profile/${normalizedPlayerNumber}`);

    if (mode) {
      profileUrl.searchParams.set('mode', mode);
    }

    const response = await this.authorizedFetch(profileUrl.toString());
    const data = await response.json().catch(() => ({ error: 'Failed to get profile' }));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get profile');
    }

    return data as UserProfileResponse;
  },

  async updateProfile(payload: { username: string; bio: string }) {
    const response = await this.authorizedFetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(error.error || 'Failed to update profile');
    }

    return response.json();
  },

  async getGameHistory(limit?: number, mode?: ProfileStatMode): Promise<{ success: boolean; games: HistoryGame[] }> {
    const searchParams = new URLSearchParams();
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      searchParams.set('limit', String(limit));
    }

    if (mode) {
      searchParams.set('mode', mode);
    }

    const response = await this.authorizedFetch(`${API_BASE}/users/me/history${searchParams.size ? `?${searchParams.toString()}` : ''}`);

    if (!response.ok) throw new Error('Failed to get game history');
    return response.json();
  },

  async getPublicGameHistory(playerNumber: string, limit?: number, mode?: ProfileStatMode): Promise<{ success: boolean; games: HistoryGame[] }> {
    const normalizedPlayerNumber = String(playerNumber).replace(/[^0-9]/g, '');
    const searchParams = new URLSearchParams();
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      searchParams.set('limit', String(limit));
    }

    if (mode) {
      searchParams.set('mode', mode);
    }

    const response = await this.authorizedFetch(`${API_BASE}/users/profile/${normalizedPlayerNumber}/history${searchParams.size ? `?${searchParams.toString()}` : ''}`);
    const data = await response.json().catch(() => ({ error: 'Failed to get game history' }));

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get game history');
    }

    return data as { success: boolean; games: HistoryGame[] };
  },

  async getFriendsOverview(): Promise<FriendsOverviewResponse> {
    const response = await this.authorizedFetch(`${API_BASE}/users/me/friends`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to load friends' }));
      throw new Error(error.error || 'Failed to load friends');
    }

    return response.json();
  },

  async searchFriendByPlayerNumber(playerNumber: string): Promise<FriendSearchResult> {
    const searchParams = new URLSearchParams({ playerNumber });
    const response = await this.authorizedFetch(`${API_BASE}/users/friends/search?${searchParams.toString()}`);

    const data = await response.json().catch(() => ({ error: 'Failed to search player' }));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to search player');
    }

    return data as FriendSearchResult;
  },

  async sendFriendRequest(playerNumber: string) {
    const response = await this.authorizedFetch(`${API_BASE}/users/me/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerNumber }),
    });

    const data = await response.json().catch(() => ({ error: 'Failed to add friend' }));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add friend');
    }

    return data as { success: boolean; friendshipId: string | null; relationshipStatus: 'friend' | 'outgoing_pending' };
  },

  async respondToFriendRequest(friendshipId: string, action: 'accept' | 'decline') {
    const response = await this.authorizedFetch(`${API_BASE}/users/me/friends/${friendshipId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });

    const data = await response.json().catch(() => ({ error: 'Failed to respond to friend request' }));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to respond to friend request');
    }

    return data as { success: boolean; relationshipStatus: 'friend' | 'none' };
  },

  async removeFriendship(friendshipId: string) {
    const response = await this.authorizedFetch(`${API_BASE}/users/me/friends/${friendshipId}`, {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => ({ error: 'Failed to remove friendship' }));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove friendship');
    }

    return data as { success: boolean };
  },
};
