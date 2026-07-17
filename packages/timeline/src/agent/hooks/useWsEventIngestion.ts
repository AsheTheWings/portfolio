'use client';

/**
 * useWsEventIngestion - Central WS event handler
 *
 * Listens to all server→client WS messages and routes them:
 * - session_event       → store.appendEvent (handles catch-up + live events
 *                         uniformly; lifecycle events transition WorkflowStatus
 *                         and bulk-update agentStatuses inside the store;
 *                         workflow_failed also surfaces provider errors).
 * - session_created     → store.setCurrentSessionId + URL update.
 * - session_branched    → navigation to new branch session.
 * - error               → store.setError.
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
import { toastError } from '@portfolio/ui/components/FeedbackMessage';
import type { SessionEvent } from '../types';
import type {
  WsSessionEventMessage,
  WsSessionCreatedMessage,
  WsSessionBranchedMessage,
  WsErrorMessage,
  WireSessionEvent,
  WsAgentErrorPayload,
} from '../types/protocol';
import { workflowRecoveryCommand } from '../lib/workflow-recovery';

const CHUNK_TYPES = new Set(['model-thought-chunk', 'model-message-chunk']);

/**
 * Convert a wire event (ISO timestamp string) to a rich SessionEvent (Date)
 */
function wireToSessionEvent(wire: WireSessionEvent): SessionEvent {
  return {
    ...wire,
    timestamp: new Date(wire.timestamp),
  } as unknown as SessionEvent;
}

/** Collapse key: type + agentId. Correctly handles parallel agents. */
function chunkKey(event: SessionEvent): string {
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
    default:
      return 'An unexpected error occurred during execution.';
  }
}

function getWorkflowFailedError(event: SessionEvent): WsAgentErrorPayload | undefined {
  if (event.type !== 'workflow_failed') return undefined;
  return (event.data as { error?: WsAgentErrorPayload }).error;
}

function ingestSessionEvent(event: SessionEvent): void {
  const store = useAgentStore.getState();

  if (event.type === 'user-input-committed') {
    window.dispatchEvent(new Event('agent:collapseAll'));
  }

  store.appendEvent(event);

  if (event.type === 'workflow_aborted') {
    // agent-turn-completed isn't emitted on abort, so streaming composites
    // would otherwise stay marked as streaming forever.
    store.setSessionComponents(
      (components) => components.map((c) => (c.isStreaming ? { ...c, isStreaming: false } : c)),
    );
    return;
  }

  if (event.type === 'workflow_failed') {
    const errorMessage = formatAgentExecutionError(getWorkflowFailedError(event));
    store.setError(errorMessage);
    toastError(errorMessage);
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
function collapseBuffer(buffer: SessionEvent[]): SessionEvent[] {
  if (buffer.length <= 1) return buffer;

  const collapsed: SessionEvent[] = [];
  let pendingChunk: SessionEvent | null = null;
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
      pendingChunk = { ...event, data: { ...event.data } } as SessionEvent;
      pendingKey = key;
    }
  }

  if (pendingChunk) collapsed.push(pendingChunk);
  return collapsed;
}

interface UseWsEventIngestionOptions {
  /** Called when backend creates a new session (for URL update) */
  onSessionCreated?: (sessionId: string) => void;
  /** Called when backend creates a branch session (for URL navigation) */
  onSessionBranched?: (newSessionId: string) => void;
}

export function useWsEventIngestion(options?: UseWsEventIngestionOptions) {
  const { client } = useAgentConnection();
  const onSessionCreatedRef = useRef(options?.onSessionCreated);
  onSessionCreatedRef.current = options?.onSessionCreated;
  const onSessionBranchedRef = useRef(options?.onSessionBranched);
  onSessionBranchedRef.current = options?.onSessionBranched;

  // Background tab buffering
  const eventBuffer = useRef<SessionEvent[]>([]);
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
        ingestSessionEvent(event);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const unsubSession = client.on('session_event', (msg: WsSessionEventMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      const event = wireToSessionEvent(msg.event);

      if (isHidden.current) {
        eventBuffer.current.push(event);
        return;
      }

      ingestSessionEvent(event);
    });

    const unsubCreated = client.on('session_created', (msg: WsSessionCreatedMessage) => {
      console.log(`[WsIngestion] session_created — newSessionId=${msg.sessionId}`);
      useAgentStore.getState().setCurrentSessionId(msg.sessionId);
      onSessionCreatedRef.current?.(msg.sessionId);
    });

    const unsubError = client.on('error', (msg: WsErrorMessage) => {
      useAgentStore.getState().setError(msg.error);
      const recoveryCommand = workflowRecoveryCommand(msg);
      toastError(msg.error, recoveryCommand ? {
        description: 'Reset the paused workflow to continue this session with the current version.',
        duration: 15_000,
        action: {
          label: 'Reset workflow',
          onClick: () => client.send(recoveryCommand),
        },
      } : undefined);
    });

    const unsubBranched = client.on('session_branched', (msg: WsSessionBranchedMessage) => {
      onSessionBranchedRef.current?.(msg.newSessionId);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubSession();
      unsubCreated();
      unsubError();
      unsubBranched();
      // Flush any remaining buffered events on cleanup
      if (eventBuffer.current.length > 0) {
        const collapsed = collapseBuffer(eventBuffer.current);
        eventBuffer.current = [];
        for (const event of collapsed) {
          ingestSessionEvent(event);
        }
      }
    };
  }, [client]);
}
