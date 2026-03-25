import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: 'google' | 'anonymous';
  googleConnected: boolean;
}

interface UserState {
  user: UserProfile | null;
  isLoading: boolean;

  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        set({ user: null, isLoading: false });
        return;
      }
      const data = await res.json();
      set({ user: data.user ?? null, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    set({ user: null });
    // Clear local session and reload to reset all stores
    localStorage.removeItem('girlbot-user-id');
    window.location.href = '/';
  },
}));
