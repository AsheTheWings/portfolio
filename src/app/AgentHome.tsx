'use client';

/**
 * AgentHome — client wrapper for the home page.
 * Shows AuthGate when not authenticated, AgentPlayground when authenticated.
 */

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { AuthGate } from '@/features/authentication/components/AuthGate';
import { AgentConnectionProvider } from '@/features/agent/hooks/useAgentConnection';
import { AgentPlayground } from '@/features/agent';
import type { UserPublic } from '@/features/authentication/types';
import type { AgentServerData } from '@/features/agent/lib/server-data';
import type { WireSessionEvent } from '@/features/agent/types/protocol';

interface AgentHomeProps {
  initialUser: UserPublic | null;
  initialAgentData: AgentServerData;
  initialEvents?: WireSessionEvent[] | null;
}

export function AgentHome({ initialUser, initialAgentData, initialEvents }: AgentHomeProps) {
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
