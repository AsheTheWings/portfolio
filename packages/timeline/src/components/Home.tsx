'use client';

/**
 * Home — client wrapper for the Timeline home page.
 * Shows AuthGate when not authenticated, AgentPlayground when authenticated.
 */

import { useParams } from 'next/navigation';
import { useAuthStore } from '@portfolio/auth/stores/authStore';
import { AuthGate } from '@portfolio/auth/components/AuthGate';
import { AuthHydrator } from '@portfolio/auth/components/AuthHydrator';
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
  const { isAuthenticated, _hydrated } = useAuthStore();
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  // Once the store has been hydrated (setUser called), it's authoritative.
  // This ensures logout() immediately deauths even if stale SSR initialUser is still in props.
  const effectiveAuth = _hydrated ? isAuthenticated : (isAuthenticated || !!initialUser);

  if (!effectiveAuth) {
    return (
      <AuthHydrator initialUser={initialUser}>
        <AuthGate />
      </AuthHydrator>
    );
  }

  return (
    <AuthHydrator initialUser={initialUser}>
      <AgentConnectionProvider>
        <AgentPlayground sessionId={sessionId} initialAgentData={initialAgentData} initialEvents={initialEvents} />
      </AgentConnectionProvider>
    </AuthHydrator>
  );
}
