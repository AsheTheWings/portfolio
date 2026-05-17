'use client';

/**
 * Home — client wrapper for the Timeline home page.
 * Shows AuthGate when not authenticated, AgentPlayground when authenticated.
 */

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { AuthGate } from '@portfolio/auth/components/AuthGate';
import { AgentConnectionProvider } from '@portfolio/timeline/agent/hooks/useAgentConnection';
import { AgentPlayground } from '@portfolio/timeline/agent';
import type { UserPublic } from '@portfolio/auth/types';
import type { AgentServerData } from '@portfolio/timeline/agent/lib/server-data';
import type { WireSessionEvent } from '@portfolio/timeline/agent/types/protocol';

interface HomeProps {
  initialUser: UserPublic | null;
  initialAgentData: AgentServerData;
  initialEvents?: WireSessionEvent[] | null;
}

export function Home({ initialUser, initialAgentData, initialEvents }: HomeProps) {
  const { user, isAuthenticated, _hydrated, setUser } = useAuthStore();
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  // Hydrate auth store from server-rendered initial data
  useEffect(() => {
    if (initialUser && !user) {
      setUser(initialUser);
    }
  }, [initialUser, user, setUser]);

  // Once the store has been hydrated (setUser called), it's authoritative.
  // This ensures logout() immediately deauths even if stale SSR initialUser is still in props.
  const effectiveUser = _hydrated ? user : (user ?? initialUser);
  const effectiveAuth = _hydrated ? isAuthenticated : (isAuthenticated || !!initialUser);

  if (!effectiveAuth || !effectiveUser) {
    return <AuthGate />;
  }

  return (
    <AgentConnectionProvider>
      <AgentPlayground sessionId={sessionId} initialAgentData={initialAgentData} initialEvents={initialEvents} />
    </AgentConnectionProvider>
  );
}
