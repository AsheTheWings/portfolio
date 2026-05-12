'use client';

/**
 * useWsEventIngestion - Central WS event handler
 *
 * Listens to all server→client WS messages and routes them:
 * - session_event    → store.appendEvent (handles catch-up + live events uniformly)
 * - session_created  → store.setCurrentAgentSessionId + URL update
 * - agent_status     → store.setAgentStatus / resetAllAgentStatuses
 * - session_branched → navigation to new branch session
 * - error            → store.setError
 *
 * Background tab optimization:
 * When the browser tab is hidden, incoming session_event messages are buffered
 * instead of processed immediately. On tab return, chunk events are collapsed
 * by type+agentId (merging incremental text) before replay. This avoids the
 * freeze caused by processing hundreds of individual chunk updates at once.
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { toastError } from '@/features/shared/components/FeedbackMessage';
import type { AgentSessionEvent } from '../types';
import type {
  WsAgentSessionEventMessage,
  WsAgentSessionCreatedMessage,
  WsAgentStatusMessage,
  WsSessionBranchedMessage,
  WsErrorMessage,
  WireAgentSessionEvent,
  WsAgentErrorPayload,
} from '../types/protocol';
import { deriveAgentStatuses } from '../utils/agent-status';

const CHUNK_TYPES = new Set(['model-thought-chunk', 'model-message-chunk']);

/**
 * Convert a wire event (ISO timestamp string) to a rich AgentSessionEvent (Date)
 */
function wireToAgentSessionEvent(wire: WireAgentSessionEvent): AgentSessionEvent {
  return {
    ...wire,
    timestamp: new Date(wire.timestamp),
  } as unknown as AgentSessionEvent;
}

/** Collapse key: type + agentId. Correctly handles parallel agents. */
function chunkKey(event: AgentSessionEvent): string {
  return `${event.type}:${event.agentId ?? 'none'}`;
}

function formatAgentExecutionError(error: WsAgentErrorPayload | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';

  const modelSuffix = error.modelId ? ` (${error.modelId})` : '';

  switch (error.code) {
    case 'MISSING_API_KEY':
      return 'This agent needs an API key before it can run. Add the provider key in Settings → API Keys.';
    case 'MODEL_UNAVAILABLE':
      return `This agent’s configured model is no longer available${modelSuffix}. Choose another model.`;
    case 'MODEL_PROVIDER_AUTH_FAILED':
      return 'The provider rejected your API key. Check or replace it in Settings → API Keys.';
    case 'MODEL_PROVIDER_RATE_LIMITED':
      return 'The model provider rate-limited this request. Try again later.';
    case 'MODEL_PROVIDER_FAILED':
      return error.retryable
        ? 'The model provider failed to complete this request. Try again.'
        : 'The model provider rejected this request. Check the selected model and provider settings.';
    case 'AGENT_RUNTIME_ERROR':
      return 'The agent failed while processing this request. Please try again.';
  }
}

/**
 * Collapse a buffer of events: merge consecutive chunk events for the same
 * type+agentId into a single event with concatenated text. Non-chunk
 * events pass through as-is.
 *
 * Preserves event ordering relative to non-chunk boundaries. Example:
 *   [chunk-A, chunk-A, tool-call-B, chunk-A, chunk-A]
 * → [merged-chunk-A, tool-call-B, merged-chunk-A]
 *
 * This ensures tool-calls and status transitions appear in the correct
 * sequence relative to the text that preceded them.
 */
function collapseBuffer(buffer: AgentSessionEvent[]): AgentSessionEvent[] {
  if (buffer.length <= 1) return buffer;

  const collapsed: AgentSessionEvent[] = [];
  let pendingChunk: AgentSessionEvent | null = null;
  let pendingKey: string | null = null;

  for (const event of buffer) {
    if (!CHUNK_TYPES.has(event.type)) {
      // Non-chunk: flush any pending chunk, then emit this event
      if (pendingChunk) {
        collapsed.push(pendingChunk);
        pendingChunk = null;
        pendingKey = null;
      }
      collapsed.push(event);
      continue;
    }

    // Chunk event — merge if same type+agentId as pending
    const key = chunkKey(event);
    if (pendingChunk && pendingKey === key) {
      // Merge text into pending chunk
      const dataKey = event.type === 'model-message-chunk' ? 'message' : 'thoughts';
      const pendingData = pendingChunk.data as unknown as Record<string, unknown>;
      const eventData = event.data as unknown as Record<string, unknown>;
      pendingData[dataKey] = (pendingData[dataKey] as string) + (eventData[dataKey] as string);
      // Take latest metadata
      pendingData.metadata = eventData.metadata;
    } else {
      // Different key — flush pending, start new
      if (pendingChunk) collapsed.push(pendingChunk);
      // Clone to avoid mutating the original event later
      pendingChunk = { ...event, data: { ...event.data } } as AgentSessionEvent;
      pendingKey = key;
    }
  }

  if (pendingChunk) collapsed.push(pendingChunk);
  return collapsed;
}

interface UseWsEventIngestionOptions {
  /** Called when backend creates a new session (for URL update) */
  onAgentSessionCreated?: (sessionId: string) => void;
  /** Called when backend creates a branch session (for URL navigation) */
  onSessionBranched?: (newSessionId: string) => void;
}

export function useWsEventIngestion(options?: UseWsEventIngestionOptions) {
  const { client } = useAgentConnection();
  const onAgentSessionCreatedRef = useRef(options?.onAgentSessionCreated);
  onAgentSessionCreatedRef.current = options?.onAgentSessionCreated;
  const onSessionBranchedRef = useRef(options?.onSessionBranched);
  onSessionBranchedRef.current = options?.onSessionBranched;

  // Background tab buffering
  const eventBuffer = useRef<AgentSessionEvent[]>([]);
  const isHidden = useRef(false);

  useEffect(() => {
    if (!client) return;

    // --- Visibility change handler ---
    const handleVisibility = () => {
      if (document.hidden) {
        isHidden.current = true;
        return;
      }

      // Tab became visible — flush buffered events
      isHidden.current = false;
      if (eventBuffer.current.length === 0) return;

      const collapsed = collapseBuffer(eventBuffer.current);
      eventBuffer.current = [];

      const store = useAgentStore.getState();
      for (const event of collapsed) {
        if (event.type === 'user-turn-completed') {
          window.dispatchEvent(new Event('agent:collapseAll'));
        }
        store.appendEvent(event);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const unsubSession = client.on('session_event', (msg: WsAgentSessionEventMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      const event = wireToAgentSessionEvent(msg.event);

      if (isHidden.current) {
        eventBuffer.current.push(event);
        return;
      }

      // Dispatch collapse before ingesting new user turn
      if (event.type === 'user-turn-completed') {
        window.dispatchEvent(new Event('agent:collapseAll'));
      }
      useAgentStore.getState().appendEvent(event);
    });

    const unsubCreated = client.on('session_created', (msg: WsAgentSessionCreatedMessage) => {
      console.log(`[WsIngestion] session_created — newSessionId=${msg.sessionId}`);
      useAgentStore.getState().setCurrentAgentSessionId(msg.sessionId);
      onAgentSessionCreatedRef.current?.(msg.sessionId);
    });

    const unsubStatus = client.on('agent_status', (msg: WsAgentStatusMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      const store = useAgentStore.getState();

      if (msg.status === 'completed') {
        // All agents finished — flip every agent back to idle.
        store.resetAllAgentStatuses('idle');
      } else if (msg.status === 'aborted') {
        // Re-derive per-agent from event state.
        const statuses = deriveAgentStatuses(store.agentSessionEvents, store.agents);
        for (const [agentId, status] of Object.entries(statuses)) {
          store.setAgentStatus(agentId, status);
        }
        // Close any composites still in streaming state — agent-turn-completed is not
        // emitted on abort, so no event will close them.
        store.setAgentSessionComponents(
          (components) => components.map((c) => (c.isStreaming ? { ...c, isStreaming: false } : c)),
        );
      } else if (msg.status === 'resuming') {
        // Re-derive components after backend cleanup
        if (msg.deletedEventIds?.length) {
          const remaining = store.agentSessionEvents.filter(
            (e) => !msg.deletedEventIds!.includes(e.eventId),
          );
          store.hydrateFromEvents(remaining);
        }
      } else if (msg.status === 'error') {
        const statuses = deriveAgentStatuses(store.agentSessionEvents, store.agents);
        for (const [agentId, status] of Object.entries(statuses)) {
          store.setAgentStatus(agentId, status);
        }
        const errorMessage = formatAgentExecutionError(msg.error);
        store.setError(errorMessage);
        toastError(errorMessage);
      } else if (msg.status === 'paused') {
        // Backend paused all active agents awaiting user feedback.
        store.resetAllAgentStatuses('waitingFeedback');
      }
    });

    const unsubError = client.on('error', (msg: WsErrorMessage) => {
      useAgentStore.getState().setError(msg.error);
    });

    const unsubBranched = client.on('session_branched', (msg: WsSessionBranchedMessage) => {
      onSessionBranchedRef.current?.(msg.newSessionId);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubSession();
      unsubCreated();
      unsubStatus();
      unsubError();
      unsubBranched();
      // Flush any remaining buffered events on cleanup
      if (eventBuffer.current.length > 0) {
        const collapsed = collapseBuffer(eventBuffer.current);
        eventBuffer.current = [];
        const cleanupStore = useAgentStore.getState();
        for (const event of collapsed) {
          cleanupStore.appendEvent(event);
        }
      }
    };
  }, [client]);
}
