import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class APIClient {
  private client: AxiosInstance;
  private token: string | null = localStorage.getItem('auth_token');

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Auth endpoints
  async signIn(identityToken: string, user?: any) {
    const response = await this.client.post('/auth/signin', {
      identityToken,
      user,
    });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  async verifyToken() {
    return this.client.get('/auth/verify');
  }

  // Game endpoints
  async createGameVsAI(difficulty: number = 3) {
    return this.client.post('/games/vs-ai', { difficulty });
  }

  async getGameState(gameId: string) {
    return this.client.get(`/games/${gameId}`);
  }

  async makeMove(gameId: string, move: { from: string; to: string; promotion?: string }) {
    return this.client.post(`/games/${gameId}/move`, { move });
  }

  async resignGame(gameId: string) {
    return this.client.post(`/games/${gameId}/resign`);
  }

  // User endpoints
  async getUserProfile() {
    return this.client.get('/users/me');
  }

  async getUserStats(userId: string) {
    return this.client.get(`/users/${userId}/stats`);
  }

  async getUserGames(userId: string, limit: number = 10, offset: number = 0) {
    return this.client.get(`/users/${userId}/games`, {
      params: { limit, offset },
    });
  }
}

export const apiClient = new APIClient();
