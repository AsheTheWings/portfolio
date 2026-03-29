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
import { startEventBuffering, drainEventBuffer } from '../lib/event-buffer';
import { processLiveEvent } from '../lib/process-event';
import { saveCurrentAgentSessionId } from '../utils/agent-storage';
import type { AgentSessionEvent } from '../types';

export function useAgentSessionLifecycle() {
  const { send } = useAgentConnection();

  /**
   * Load existing session from REST and subscribe to live events via WS.
   *
   * Uses subscribe-first + buffer pattern to avoid event gaps:
   * 1. Start buffering WS events
   * 2. Set session ID + subscribe via WS (events now buffer)
   * 3. Fetch snapshot via REST
   * 4. Hydrate store from snapshot
   * 5. Drain buffer, replay non-duplicate events
   */
  const loadAgentSession = useCallback(
    async (sessionId: string) => {
      const store = useAgentStore.getState();

      try {
        store.setError(null);

        // 1. Start buffering — any WS session_events are queued instead of processed
        startEventBuffering();

        // 2. Set session ID early so the WS ingestion handler accepts events for this session
        store.setCurrentAgentSessionId(sessionId);
        saveCurrentAgentSessionId(sessionId);
        store.clearActiveFeedbackRequest();

        // 3. Subscribe via WS — server starts pushing events (buffered on client)
        send({ type: 'subscribe', sessionId });

        // 4. Fetch snapshot via REST
        const { events, session: sessionMeta } = await fetchAgentSessionEvents(sessionId);

        // 5. Hydrate store from snapshot
        store.hydrateFromEvents(events as AgentSessionEvent[]);

        // Extract user messages for history navigation
        const userMessages = (events as AgentSessionEvent[])
          .filter((e) => e.type === 'user-turn-completed' && (e.data as { message?: string }).message)
          .map((e) => (e.data as { message?: string }).message)
          .filter((m): m is string => typeof m === 'string')
          .reverse()
          .slice(0, 20);
        store.setUserMessagesHistory(userMessages);

        // 6. Drain buffer and replay non-duplicate events
        const buffered = drainEventBuffer();
        if (buffered.length > 0) {
          const knownIds = new Set((events as AgentSessionEvent[]).map((e) => e.eventId));
          const newEvents = buffered
            .filter((e) => !knownIds.has(e.eventId))
            .sort((a, b) => a.sequence - b.sequence);

          // Log sequence gaps (observability — no auto-retry)
          if (newEvents.length > 0) {
            const allSeqs = [
              ...(events as AgentSessionEvent[]).map((e) => e.sequence),
              ...newEvents.map((e) => e.sequence),
            ].sort((a, b) => a - b);
            for (let i = 1; i < allSeqs.length; i++) {
              if (allSeqs[i] - allSeqs[i - 1] > 1) {
                console.warn(`[agent] Sequence gap: ${allSeqs[i - 1]} → ${allSeqs[i]}`);
              }
            }
          }

          for (const event of newEvents) {
            processLiveEvent(event);
          }
        }

        // 7. Detect interrupted state: last event is user turn with no agent response
        const allEvents = events as AgentSessionEvent[];
        if (allEvents.length > 0) {
          const lastEvent = allEvents[allEvents.length - 1];
          if (lastEvent.type === 'user-turn-completed') {
            store.setConversationStatus('interrupted');
          }
        }

        return { sessionId, metadata: sessionMeta };
      } catch (e: unknown) {
        // Stop buffering on error to prevent stale events leaking into next load
        drainEventBuffer();
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
