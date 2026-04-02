const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const apiClient = {
  // Auth
  async getToken(): Promise<string | null> {
    return localStorage.getItem('authToken');
  },

  async setToken(token: string) {
    localStorage.setItem('authToken', token);
  },

  // Games
  async createGame(difficulty: number = 3) {
    const token = await this.getToken();
    const response = await fetch(`${API_BASE}/games/vs-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ difficulty }),
    });

    if (!response.ok) throw new Error('Failed to create game');
    return response.json();
  },

  async finishGame(gameId: string, result: 'white' | 'black' | 'draw', pgn: string, finalFen: string) {
    const token = await this.getToken();
    const response = await fetch(`${API_BASE}/games/${gameId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ result, pgn, finalFen }),
    });

    if (!response.ok) throw new Error('Failed to finish game');
    return response.json();
  },

  // Users
  async getProfile() {
    const token = await this.getToken();
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get profile');
    return response.json();
  },

  async getGameHistory() {
    const token = await this.getToken();
    const response = await fetch(`${API_BASE}/users/me/history`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get game history');
    return response.json();
  },
};
