'use client';

/**
 * Authentication Context
 * 
 * Pure reactive state management for authentication.
 * No localStorage - relies on:
 * - Server Components for initial state (from HTTP-only cookies)
 * - This context for reactive updates (login/logout commands)
 * - HTTP-only cookies for persistence (managed server-side)
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserPublic } from '../types';

interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  setUser: (user: UserPublic | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: UserPublic | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  // Pure reactive state - no localStorage, cookies handle persistence
  const [user, setUser] = useState<UserPublic | null>(initialUser);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
