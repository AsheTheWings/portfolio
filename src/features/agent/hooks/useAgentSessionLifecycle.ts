'use client';

/**
 * useAgentSessionLifecycle Hook
 * 
 * Session lifecycle via REST + WS:
 * - loadAgentSession: REST fetch events → store.hydrateFromEvents + WS subscribe
 * - clearAgentSession: REST delete + WS unsubscribe + clear store
 * - New sessions are created implicitly by backend on first user_message
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { fetchAgentSessionEvents, deleteAgentSession } from '../lib/agent-api';
import { saveCurrentAgentSessionId } from '../utils/agent-storage';
import type { AgentSessionEvent } from '../types';

export function useAgentSessionLifecycle() {
  const { send } = useAgentConnection();

  /**
   * Load existing session from REST and subscribe to live events via WS
   */
  const loadAgentSession = useCallback(
    async (sessionId: string) => {
      const store = useAgentStore.getState();

      try {
        store.setError(null);

        // Fetch events from REST
        const { events, session: sessionMeta } = await fetchAgentSessionEvents(sessionId);

        // Set current session
        store.setCurrentAgentSessionId(sessionId);
        saveCurrentAgentSessionId(sessionId);

        // Clear old state and exit feedback mode
        store.clearActiveFeedbackRequest();

        // Hydrate components from event history
        store.hydrateFromEvents(events as AgentSessionEvent[]);

        // Extract user messages for history navigation
        const userMessages = (events as AgentSessionEvent[])
          .filter((e) => e.type === 'user-turn-completed' && (e.data as { message?: string }).message)
          .map((e) => (e.data as { message?: string }).message)
          .filter((m): m is string => typeof m === 'string')
          .reverse()
          .slice(0, 20);
        store.setUserMessagesHistory(userMessages);

        // Subscribe to live events via WS
        send({ type: 'subscribe', sessionId });

        return { sessionId, metadata: sessionMeta };
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load session';
        useAgentStore.getState().setError(errorMessage);
        console.error('Failed to load session:', e);
        throw e;
      }
    },
    [send]
  );

  /**
   * Clear current session — unsubscribes WS, clears store, optionally deletes
   */
  const clearAgentSession = useCallback(
    async (opts?: { delete?: boolean }) => {
      const store = useAgentStore.getState();
      const sessionId = store.currentSessionId;

      if (sessionId) {
        // Unsubscribe from live events
        send({ type: 'unsubscribe', sessionId });

        if (opts?.delete) {
          try {
            await deleteAgentSession(sessionId);
          } catch (e) {
            console.error('Failed to delete session:', e);
          }
        }
      }

      store.setCurrentAgentSessionId(null);
      store.clearComponents();
      store.clearUserMessagesHistory();
      store.clearActiveFeedbackRequest();
      store.selectJob(null);
      saveCurrentAgentSessionId(null);
    },
    [send]
  );

  return {
    loadAgentSession,
    clearAgentSession,
  };
}
