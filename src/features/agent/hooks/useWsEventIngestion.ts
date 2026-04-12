'use client';

/**
 * useWsEventIngestion - Central WS event handler
 *
 * Listens to all server→client WS messages and routes them:
 * - session_event    → processLiveEvent (handles catch-up + live events uniformly)
 * - session_created  → store.setCurrentAgentSessionId + URL update
 * - agent_status     → store.setConversationStatus
 * - session_branched → navigation to new branch session
 * - error            → store.setError
 *
 * Background tab optimization:
 * When the browser tab is hidden, incoming session_event messages are buffered
 * instead of processed immediately. On tab return, chunk events are collapsed
 * by componentId (merging incremental text) before replay. This avoids the
 * freeze caused by processing hundreds of individual chunk updates at once.
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { processLiveEvent } from '../lib/process-event';
import { toastError } from '@/features/shared/components/FeedbackMessage';
import type { AgentSessionEvent } from '../types';
import type {
  WsAgentSessionEventMessage,
  WsAgentSessionCreatedMessage,
  WsAgentStatusMessage,
  WsSessionBranchedMessage,
  WsErrorMessage,
  WireAgentSessionEvent,
} from '../types/protocol';

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

/**
 * Collapse a buffer of events: merge consecutive chunk events for the same
 * componentId+type into a single event with concatenated text. Non-chunk
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

  for (const event of buffer) {
    if (!CHUNK_TYPES.has(event.type)) {
      // Non-chunk: flush any pending chunk, then emit this event
      if (pendingChunk) {
        collapsed.push(pendingChunk);
        pendingChunk = null;
      }
      collapsed.push(event);
      continue;
    }

    // Chunk event — merge if same componentId + type as pending
    if (
      pendingChunk &&
      pendingChunk.componentId === event.componentId &&
      pendingChunk.type === event.type
    ) {
      // Merge text into pending chunk
      const dataKey = event.type === 'model-message-chunk' ? 'message' : 'thoughts';
      const pendingData = pendingChunk.data as unknown as Record<string, unknown>;
      const eventData = event.data as unknown as Record<string, unknown>;
      pendingData[dataKey] = (pendingData[dataKey] as string) + (eventData[dataKey] as string);
      // Take latest metadata
      pendingData.metadata = eventData.metadata;
    } else {
      // Different component/type — flush pending, start new
      if (pendingChunk) collapsed.push(pendingChunk);
      // Clone to avoid mutating the original event later
      pendingChunk = { ...event, data: { ...event.data } } as AgentSessionEvent;
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

      for (const event of collapsed) {
        processLiveEvent(event);
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

      processLiveEvent(event);
    });

    const unsubCreated = client.on('session_created', (msg: WsAgentSessionCreatedMessage) => {
      console.log(`[WsIngestion] session_created — newSessionId=${msg.sessionId}`);
      useAgentStore.getState().setCurrentAgentSessionId(msg.sessionId);
      onAgentSessionCreatedRef.current?.(msg.sessionId);
    });

    const unsubStatus = client.on('agent_status', (msg: WsAgentStatusMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      if (msg.status === 'completed') {
        useAgentStore.getState().setConversationStatus('healthy');
      } else if (msg.status === 'aborted') {
        // Agent was stopped mid-turn — no agent-turn-completed event was emitted,
        // so the session is in an incomplete state. Match the reload behavior in
        // useAgentSessionLifecycle which detects this same condition.
        useAgentStore.getState().setConversationStatus('interrupted');
      } else if (msg.status === 'resuming') {
        // Remove stale streaming components before agent resumes
        if (msg.deletedComponentIds?.length) {
          const store = useAgentStore.getState();
          for (const cid of msg.deletedComponentIds) {
            store.removeComponent(cid);
          }
        }
      } else if (msg.status === 'error') {
        useAgentStore.getState().setConversationStatus('interrupted');
        const errorMessage = msg.error || 'Something went wrong. Please try again.';
        useAgentStore.getState().setError(errorMessage);
        toastError(errorMessage);
      } else if (msg.status === 'paused') {
        useAgentStore.getState().setConversationStatus('waitingFeedback');
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
        for (const event of collapsed) {
          processLiveEvent(event);
        }
      }
    };
  }, [client]);
}
