'use client';

/**
 * Agent Context - Simplified wrapper using Zustand store and hooks
 * Provides React Context for auth-based cleanup + WS connection
 */

import { createContext, ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { useAgentStore } from '../stores/useAgentStore';
import { AgentConnectionProvider } from '../hooks/useAgentConnection';
import { fetchTools } from '../lib/agent-api';

// Re-export AgentSessionComponent type for convenience
export type { AgentSessionComponent } from '../types';

// Re-export useAgent hook for convenience
export { useAgent } from '../hooks/useAgent';

// This context is now minimal - most state is in Zustand
// We only use it for auth-based cleanup
type AgentContextValue = Record<string, never>;

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: ReactNode;
}

/**
 * Agent Provider - Manages auth-based cleanup and initial tools fetch
 * State is handled by Zustand store
 */
export function AgentProvider({ children }: AgentProviderProps) {
  const reset = useAgentStore((state) => state.reset);
  const setToolsPool = useAgentStore((state) => state.setToolsPool);

  // Fetch tools from backend on mount
  useEffect(() => {
    fetchTools().then((tools) => {
      setToolsPool(tools);
    }).catch((err) => {
      console.error('Failed to fetch tools:', err);
    });
  }, [setToolsPool]);

  // Subscribe to auth changes for logout cleanup
  useEffect(() => {
    let previousUser = useAuthStore.getState().user;

    const unsubscribe = useAuthStore.subscribe((state) => {
      const currentUser = state.user;
      if (previousUser && !currentUser) {
        reset();
      }
      previousUser = currentUser;
    });

    return unsubscribe;
  }, [reset]);

  return (
    <AgentConnectionProvider>
      <AgentContext.Provider value={{}}>
        {children}
      </AgentContext.Provider>
    </AgentConnectionProvider>
  );
}
