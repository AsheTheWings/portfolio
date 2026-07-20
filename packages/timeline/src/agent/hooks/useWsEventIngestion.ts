'use client';

/**
 * useWsEventIngestion - Central WS event handler
 *
 * Listens to all server→client WS messages and routes them:
 * - session_event → typed durable state with explicit delivery origin.
 * - workflow_accepted → implicit-session routing.
 * - session_branched → branch navigation.
 * - SDK problem occurrences → scoped transient state and supplementary live
 *   workflow notification.
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
  WsSessionBranchedMessage,
  WireSessionEvent,
} from '../types/protocol';
import type { SessionEventDelivery } from '@agentime/protocol';
import { runScopedCommand } from '../problems/commands';
import { resolveProblemPresentation } from '../problems/presentation';

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

function ingestSessionEvent(
  event: SessionEvent,
  delivery: SessionEventDelivery,
): void {
  const store = useAgentStore.getState();

  if (event.type === 'user-input-committed') {
    window.dispatchEvent(new Event('agent:collapseAll'));
  }

  store.appendEvent(event, delivery);

  if (event.type === 'workflow_aborted') {
    // agent-turn-completed isn't emitted on abort, so streaming composites
    // would otherwise stay marked as streaming forever.
    store.setSessionComponents(
      (components) => components.map((c) => (c.isStreaming ? { ...c, isStreaming: false } : c)),
    );
    return;
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
interface BufferedEvent {
  event: SessionEvent;
  delivery: SessionEventDelivery;
}

function collapseBuffer(buffer: BufferedEvent[]): BufferedEvent[] {
  if (buffer.length <= 1) return buffer;

  const collapsed: BufferedEvent[] = [];
  let pendingChunk: BufferedEvent | null = null;
  let pendingKey: string | null = null;

  for (const buffered of buffer) {
    const event = buffered.event;
    if (!CHUNK_TYPES.has(event.type)) {
      // Non-chunk: flush any pending chunk, then emit this event
      if (pendingChunk) {
        collapsed.push(pendingChunk);
        pendingChunk = null;
        pendingKey = null;
      }
      collapsed.push(buffered);
      continue;
    }

    // Chunk event — merge if same type+agentId as pending
    const key = chunkKey(event);
    if (pendingChunk && pendingKey === key) {
      // Merge text into pending chunk
      const dataKey = event.type === 'model-message-chunk' ? 'message' : 'thoughts';
      const pendingData = pendingChunk.event.data as unknown as Record<string, unknown>;
      const eventData = event.data as unknown as Record<string, unknown>;
      pendingData[dataKey] = (pendingData[dataKey] as string) + (eventData[dataKey] as string);
      // Take latest metadata
      pendingData.metadata = eventData.metadata;
    } else {
      // Different key — flush pending, start new
      if (pendingChunk) collapsed.push(pendingChunk);
      // Clone to avoid mutating the original event later
      pendingChunk = {
        ...buffered,
        event: { ...event, data: { ...event.data } } as SessionEvent,
      };
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
  const eventBuffer = useRef<BufferedEvent[]>([]);
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

      for (const buffered of collapsed) {
        ingestSessionEvent(buffered.event, buffered.delivery);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const unsubSession = client.on('session_event', (msg: WsSessionEventMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      const event = wireToSessionEvent(msg.event);

      if (isHidden.current) {
        eventBuffer.current.push({ event, delivery: msg.delivery });
        return;
      }

      ingestSessionEvent(event, msg.delivery);
    });

    const unsubAccepted = client.on('workflow_accepted', (msg) => {
      const store = useAgentStore.getState();
      if (store.currentSessionId !== msg.sessionId) {
        store.setCurrentSessionId(msg.sessionId);
        onSessionCreatedRef.current?.(msg.sessionId);
      }
    });

    const unsubProblems = client.onProblem((occurrence) => {
      const store = useAgentStore.getState();
      if (occurrence.source === 'connection') {
        const phase = occurrence.problem.code === 'AUTHENTICATION_REQUIRED'
          ? 'authentication'
          : occurrence.problem.code === 'PROTOCOL_VERSION_UNSUPPORTED'
            ? 'protocol'
            : 'transport';
        store.recordProblem({
          diagnosticId: occurrence.problem.diagnosticId,
          problem: occurrence.problem,
          delivery: 'connection',
          observedAt: new Date().toISOString(),
          location: { kind: 'connection', phase },
        });
        store.setConnectionProblem({
          ...store.connectionProblem,
          status: 'error',
          problemDiagnosticId: occurrence.problem.diagnosticId,
        });
        return;
      }

      if (occurrence.source === 'workflow_state_uncertain') {
        store.recordProblem({
          diagnosticId: occurrence.problem.diagnosticId,
          problem: occurrence.problem,
          delivery: 'connection',
          observedAt: new Date().toISOString(),
          location: {
            kind: 'workflow',
            sessionId: occurrence.sessionId,
            runId: occurrence.runId,
          },
        });
        store.markWorkflowUncertain({
          sessionId: occurrence.sessionId,
          workflowId: occurrence.workflowId,
          runId: occurrence.runId,
          problemDiagnosticId: occurrence.problem.diagnosticId,
          synchronization: 'synchronizing',
        });
        void runScopedCommand(
          client.command.bind(client),
          {
            type: 'sync_session',
            sessionId: occurrence.sessionId,
            lastSequence: store.sessionEvents.at(-1)?.sequence ?? -1,
          },
          `workflow-sync:${occurrence.runId}`,
        ).then(() => {
          store.setWorkflowSynchronization(occurrence.runId, 'synchronized');
        }).catch(() => {
          store.setWorkflowSynchronization(occurrence.runId, 'required');
        });
        return;
      }

      if (
        occurrence.source === 'workflow'
        && occurrence.delivery === 'live'
        && !occurrence.duplicate
        && !store.notifiedProblemIds[occurrence.problem.diagnosticId]
      ) {
        const presentation = resolveProblemPresentation(occurrence.problem, {
          kind: 'workflow',
          sessionId: occurrence.sessionId,
          runId: occurrence.runId,
        });
        toastError(presentation.title, { description: presentation.message });
        store.markProblemNotified(occurrence.problem.diagnosticId);
      }
    });

    const unsubBranched = client.on('session_branched', (msg: WsSessionBranchedMessage) => {
      onSessionBranchedRef.current?.(msg.newSessionId);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubSession();
      unsubAccepted();
      unsubProblems();
      unsubBranched();
      // Flush any remaining buffered events on cleanup
      if (eventBuffer.current.length > 0) {
        const collapsed = collapseBuffer(eventBuffer.current);
        eventBuffer.current = [];
        for (const buffered of collapsed) {
          ingestSessionEvent(buffered.event, buffered.delivery);
        }
      }
    };
  }, [client]);
}
