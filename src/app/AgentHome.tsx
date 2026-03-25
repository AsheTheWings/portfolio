'use client';

/**
 * AgentHome — client wrapper for the home page.
 * Shows AuthGate when not authenticated, AgentPlayground when authenticated.
 */

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { AuthGate } from '@/features/authentication/components/AuthGate';
import { AgentProvider, AgentPlayground } from '@/features/agent';
import type { UserPublic } from '@/features/authentication/types';

interface AgentHomeProps {
  initialUser: UserPublic | null;
}

export function AgentHome({ initialUser }: AgentHomeProps) {
  const { user, isAuthenticated, setUser } = useAuthStore();
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  // Hydrate auth store from server-rendered initial data
  useEffect(() => {
    if (initialUser && !user) {
      setUser(initialUser);
    }
  }, [initialUser, user, setUser]);

  const effectiveUser = user ?? initialUser;
  const effectiveAuth = isAuthenticated || !!initialUser;

  if (!effectiveAuth || !effectiveUser) {
    return <AuthGate />;
  }

  return (
    <AgentProvider>
      <AgentPlayground sessionId={sessionId} />
    </AgentProvider>
  );
}
