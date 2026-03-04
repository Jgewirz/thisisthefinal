import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
        // Clear chat-related localStorage
        localStorage.removeItem('girlbot-style-profile');
      },

      getAuthHeaders: (): Record<string, string> => {
        const { token } = get();
        if (token) return { Authorization: `Bearer ${token}` };
        return {};
      },
    }),
    {
      name: 'girlbot-auth',
    }
  )
);
