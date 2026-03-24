'use client';

/**
 * Terminal Client - Client Component Wrapper
 * Handles client-side state hydration and syncs with auth store
 */

import { useEffect } from 'react';
import { Terminal } from '@/features/terminal';
import { useAuth, type UserPublic } from '@/features/authentication';

interface TerminalClientProps {
  initialUser: UserPublic | null;
  initialIsAuthenticated: boolean;
}

export function TerminalClient({ 
  initialUser, 
  initialIsAuthenticated 
}: TerminalClientProps) {
  const { user, setUser } = useAuth();
  
  // Sync server-rendered initial data with client state on mount
  useEffect(() => {
    if (initialUser && !user) {
      setUser(initialUser);
    }
  }, [initialUser, user, setUser]);
  
  // Use server-rendered initial state if available, otherwise fall back to client state
  const effectiveUser = user ?? initialUser;
  const effectiveIsAuthenticated = initialIsAuthenticated || !!user;

  return (
    <Terminal 
      initialUser={effectiveUser}
      initialIsAuthenticated={effectiveIsAuthenticated}
    />
  );
}
