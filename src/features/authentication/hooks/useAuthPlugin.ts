'use client';

/**
 * Auth Plugin Hook
 * Syncs AuthContext with authStore
 * Keeps legacy context in sync with new store architecture
 */

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../contexts/AuthContext';

export function useAuthPlugin() {
  const authStoreUser = useAuthStore((state) => state.user);
  const { setUser } = useAuth();

  // Sync context with store
  useEffect(() => {
    setUser(authStoreUser);
  }, [authStoreUser, setUser]);
}
