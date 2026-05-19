'use client';

/**
 * AuthHydrator — Hydrates auth store from server-rendered initial data
 *
 * Ensures the auth store is hydrated with server-rendered initial user data
 * before rendering children. This prevents client components that depend on
 * auth state (like navigation bars) from rendering incorrectly on direct
 * page loads due to unhydrated auth state.
 */

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { UserPublic } from '../types';

interface AuthHydratorProps {
  initialUser: UserPublic | null;
  children: React.ReactNode;
}

export function AuthHydrator({ initialUser, children }: AuthHydratorProps) {
  const { user, setUser } = useAuthStore();

  // Hydrate auth store from server-rendered initial data
  useEffect(() => {
    if (initialUser && !user) {
      setUser(initialUser);
    }
  }, [initialUser, user, setUser]);

  return <>{children}</>;
}
