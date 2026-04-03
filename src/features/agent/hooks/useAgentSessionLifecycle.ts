'use client';

/**
 * useAgentSessionLifecycle Hook
 * 
 * Session lifecycle via REST + WS:
 * - loadAgentSession: Hydrate from events (SSR or REST) + WS subscribe with lastSequence
 * - clearAgentSession: REST delete + WS unsubscribe + clear store
 * - New sessions are created implicitly by backend on first user_message
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { fetchAgentSessionEvents, deleteAgentSession } from '../lib/agent-api';
import { saveCurrentAgentSessionId } from '../utils/agent-storage';
import type { AgentSessionEvent } from '../types';
import type { WireAgentSessionEvent } from '../types/protocol';

/**
 * Convert wire events (ISO timestamps) to rich AgentSessionEvents (Date objects)
 */
function wireToAgentSessionEvents(wireEvents: WireAgentSessionEvent[]): AgentSessionEvent[] {
  return wireEvents.map(e => ({
    ...e,
    timestamp: new Date(e.timestamp),
  })) as unknown as AgentSessionEvent[];
}

export function useAgentSessionLifecycle() {
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
  const loadAgentSession = useCallback(
    async (sessionId: string, initialEvents?: WireAgentSessionEvent[]) => {
      const store = useAgentStore.getState();

      try {
        store.setError(null);
        console.log('[SessionLifecycle] loadAgentSession START', { sessionId: sessionId.slice(0, 8), hasInitialEvents: !!initialEvents });

        // 1. Get events FIRST — before clearing store to avoid empty-state flash
        //    (await breaks React's batch, so fetch before any store mutations)
        let events: AgentSessionEvent[];
        if (initialEvents) {
          events = wireToAgentSessionEvents(initialEvents);
        } else {
          const response = await fetchAgentSessionEvents(sessionId);
          events = response.events as AgentSessionEvent[];
        }

        // 2. All store mutations in one synchronous block (React batches these)
        store.setCurrentAgentSessionId(sessionId);
        store.clearComponents();
        saveCurrentAgentSessionId(sessionId);
        store.clearActiveFeedbackRequest();

        console.log('[SessionLifecycle] hydrating from', events.length, 'events');
        store.hydrateFromEvents(events);
        console.log('[SessionLifecycle] hydration complete, components:', useAgentStore.getState().sessionComponents.length);

        // Extract user messages for history navigation
        const userMessages = events
          .filter((e) => e.type === 'user-turn-completed' && (e.data as { message?: string }).message)
          .map((e) => (e.data as { message?: string }).message)
          .filter((m): m is string => typeof m === 'string')
          .reverse()
          .slice(0, 20);
        store.setUserMessagesHistory(userMessages);

        // Derive conversation status from loaded events
        if (events.length > 0) {
          const lastNonBranch = [...events].reverse().find(e => e.type !== 'branch');
          if (lastNonBranch && lastNonBranch.type !== 'agent-turn-completed') {
            store.setConversationStatus('interrupted');
          } else {
            store.setConversationStatus('healthy');
          }
        } else {
          store.setConversationStatus('healthy');
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
  const clearAgentSession = useCallback(
    async (opts?: { delete?: boolean }) => {
      const store = useAgentStore.getState();
      const sessionId = store.currentSessionId;

      console.log(`[SessionLifecycle] clearAgentSession() — sessionId=${sessionId ?? '(none)'} delete=${opts?.delete ?? false}`);

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
      store.setConversationStatus('healthy');
      store.setError(null);
      saveCurrentAgentSessionId(null);
      console.log('[SessionLifecycle] clearAgentSession() complete — store reset');
    },
    [send]
  );

  return {
    loadAgentSession,
    clearAgentSession,
  };
}
