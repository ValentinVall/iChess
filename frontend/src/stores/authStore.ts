import { create } from 'zustand';
import { apiClient } from '../api/client';

interface User {
  id: string;
  appleId?: string;
  email?: string;
  rating?: number;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  signIn: (identityToken: string, userData?: any) => Promise<void>;
  logout: () => void;
  verifyAuth: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  signIn: async (identityToken: string, userData?: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.signIn(identityToken, userData);
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Sign in failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    apiClient.clearToken();
    set({
      user: null,
      token: null,
      error: null,
    });
    localStorage.removeItem('auth_token');
  },

  verifyAuth: async () => {
    const token = get().token;
    if (!token) return false;

    try {
      const response = await apiClient.verifyToken();
      if (response.data.valid) {
        set({
          user: {
            id: response.data.userId,
            appleId: response.data.appleId,
          },
        });
        return true;
      }
    } catch (error) {
      set({ token: null, user: null });
      apiClient.clearToken();
    }
    return false;
  },

  clearError: () => set({ error: null }),
}));
