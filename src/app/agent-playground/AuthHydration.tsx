'use client';

/**
 * Auth Hydration Component
 * 
 * Syncs server-rendered auth state with client auth store.
 * Renders nothing - layout handles actual UI rendering.
 */

import { useEffect } from 'react';
import { useAuth, type UserPublic } from '@/features/authentication';

interface AuthHydrationProps {
  initialUser: UserPublic | null;
}

export function AuthHydration({ initialUser }: AuthHydrationProps) {
  const { user, setUser } = useAuth();
  
  useEffect(() => {
    if (initialUser && !user) {
      setUser(initialUser);
    }
  }, [initialUser, user, setUser]);

  return null;
}
