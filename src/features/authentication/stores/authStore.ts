/**
 * Authentication Store
 * Central state management for user authentication
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UserPublic } from '../types';

interface AuthState {
  user: UserPublic | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  
  // Actions
  setUser: (user: UserPublic | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      _hydrated: false,

      setUser: (user) =>
        set(
          { user, isAuthenticated: !!user, _hydrated: true },
          false,
          'auth/setUser'
        ),

      logout: () =>
        set(
          { user: null, isAuthenticated: false },
          false,
          'auth/logout'
        ),
    }),
    { name: 'AuthStore' }
  )
);
