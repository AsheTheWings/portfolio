'use client';

/**
 * useSessionLifecycle Hook
 * 
 * Session lifecycle via REST + WS:
 * - loadSession: Hydrate from events (SSR or REST) + WS subscribe with lastSequence
 * - clearSession: REST delete + WS unsubscribe + clear store
 * - New sessions are created implicitly by backend on first user_message
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { fetchSessionEvents, deleteSession } from '../lib/agent-api';
import { saveCurrentSessionId } from '../utils/agent-storage';
import type { SessionEvent } from '../types';
import type { WireSessionEvent } from '../types/protocol';
import { deriveAgentStatuses } from '../utils/status';

/**
 * Convert wire events (ISO timestamps) to rich SessionEvents (Date objects)
 */
function wireToSessionEvents(wireEvents: WireSessionEvent[]): SessionEvent[] {
  return wireEvents.map(e => ({
    ...e,
    timestamp: new Date(e.timestamp),
  })) as unknown as SessionEvent[];
}

export function useSessionLifecycle() {
  const { send } = useAgentConnection();

  /**
   * Load existing session and subscribe to live events via WS.
   *
   * Uses sequence-based catch-up to avoid event gaps:
   * 1. Get events (from SSR initialEvents or REST fetch)
   * 2. Hydrate store from events
   * 3. Subscribe via WS with lastSequence — backend sends missed events as catch-up
   *
   * @param sessionId - Session to load
   * @param initialEvents - Pre-fetched events from SSR (skips REST fetch)
   */
  const loadSession = useCallback(
    async (sessionId: string, initialEvents?: WireSessionEvent[]) => {
      const store = useAgentStore.getState();

      try {
        store.setError(null);

        // 1. Get events FIRST — before clearing store to avoid empty-state flash
        //    (await breaks React's batch, so fetch before any store mutations)
        let events: SessionEvent[];
        if (initialEvents) {
          events = wireToSessionEvents(initialEvents);
        } else {
          const response = await fetchSessionEvents(sessionId);
          events = response.events as SessionEvent[];
        }

        // 2. All store mutations in one synchronous block (React batches these)
        store.setCurrentSessionId(sessionId);
        store.clearEvents();
        saveCurrentSessionId(sessionId);

        store.hydrateFromEvents(events);

        // Restore agents from the last user-input-committed event.
        const lastUserTurn = [...events].reverse().find(e => e.type === 'user-input-committed');
        if (lastUserTurn) {
          const data = lastUserTurn.data as { agents?: import('../types').Agent[] };
          if (data.agents && data.agents.length > 0) {
            store.setAgents(data.agents);
          }
        }

        // Extract user messages for history navigation
        const userMessages = events
          .filter((e) => e.type === 'user-input-committed' && (e.data as { message?: string }).message)
          .map((e) => (e.data as { message?: string }).message)
          .filter((m): m is string => typeof m === 'string')
          .reverse()
          .slice(0, 20);
        store.setUserMessagesHistory(userMessages);

        // Derive per-agent statuses from loaded events.
        const derivedStatuses = deriveAgentStatuses(events, useAgentStore.getState().agents);
        for (const [agentId, status] of Object.entries(derivedStatuses)) {
          store.setAgentStatus(agentId, status);
        }

        // 3. Subscribe via WS with lastSequence — backend sends catch-up events
        const lastSequence = events.length > 0
          ? Math.max(...events.map(e => e.sequence))
          : undefined;

        send({ type: 'subscribe', sessionId, lastSequence });

        return { sessionId };
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
  const clearSession = useCallback(
    async (opts?: { delete?: boolean }) => {
      const store = useAgentStore.getState();
      const sessionId = store.currentSessionId;

      if (sessionId) {
        // Unsubscribe from live events
        send({ type: 'unsubscribe', sessionId });

        if (opts?.delete) {
          try {
            await deleteSession(sessionId);
          } catch (e) {
            console.error('Failed to delete session:', e);
          }
        }
      }

      store.setCurrentSessionId(null);
      store.clearEvents();
      store.clearUserMessagesHistory();
      store.resetAllAgentStatuses('idle');
      store.setError(null);
      // Preserve agents in store and localStorage — user keeps their agent setup for next session
      saveCurrentSessionId(null);
    },
    [send]
  );

  return {
    loadSession,
    clearSession,
  };
}
