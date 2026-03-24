'use client';

/**
 * Agent Context - Simplified wrapper using Zustand store and hooks
 * Provides React Context for auth-based cleanup
 */

import { createContext, ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { useAgentStore } from '../stores/useAgentStore';
import { useConversationStatus } from '../hooks/useConversationStatus';

// Re-export SessionComponent type for convenience
export type { SessionComponent } from '../types';

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
 * Agent Provider - Manages auth-based cleanup
 * State is handled by Zustand store
 */
export function AgentProvider({ children }: AgentProviderProps) {
  const reset = useAgentStore((state) => state.reset);
  const initializeToolsPool = useAgentStore((state) => state.initializeToolsPool);

  // Monitor conversation status
  useConversationStatus();

  // Initialize tool pool on mount
  // Note: initializeToolsPool() also handles MCP auto-connect if enabled
  useEffect(() => {
    initializeToolsPool();
  }, [initializeToolsPool]);

  // Subscribe to auth changes for logout cleanup
  useEffect(() => {
    let previousUser = useAuthStore.getState().user;

    const unsubscribe = useAuthStore.subscribe((state) => {
      const currentUser = state.user;
      // User logged out (had user, now null)
      if (previousUser && !currentUser) {
        reset();
      }
      previousUser = currentUser;
    });

    return unsubscribe;
  }, [reset]);

  return (
    <AgentContext.Provider value={{}}>
      {children}
    </AgentContext.Provider>
  );
}
