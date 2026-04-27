import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../api/client';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'list-auth',
      partialize: state => ({ token: state.token, user: state.user }),
    }
  )
);

interface UIState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()(set => ({
  activeTab: 'goals',
  setActiveTab: tab => set({ activeTab: tab }),
}));
