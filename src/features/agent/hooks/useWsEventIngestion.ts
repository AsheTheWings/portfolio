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

/**
 * Convert a wire event (ISO timestamp string) to a rich AgentSessionEvent (Date)
 */
function wireToAgentSessionEvent(wire: WireAgentSessionEvent): AgentSessionEvent {
  return {
    ...wire,
    timestamp: new Date(wire.timestamp),
  } as unknown as AgentSessionEvent;
}

interface UseWsEventIngestionOptions {
  /** Called when backend creates a new session (for URL update) */
  onAgentSessionCreated?: (sessionId: string) => void;
  /** Called when backend creates a branch session (for URL navigation) */
  onSessionBranched?: (newSessionId: string) => void;
}

export function useWsEventIngestion(options?: UseWsEventIngestionOptions) {
  const { client } = useAgentConnection();
  const store = useAgentStore();
  const onAgentSessionCreatedRef = useRef(options?.onAgentSessionCreated);
  onAgentSessionCreatedRef.current = options?.onAgentSessionCreated;
  const onSessionBranchedRef = useRef(options?.onSessionBranched);
  onSessionBranchedRef.current = options?.onSessionBranched;

  useEffect(() => {
    if (!client) return;

    const unsubSession = client.on('session_event', (msg: WsAgentSessionEventMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      if (msg.sessionId !== currentSessionId) return;

      const event = wireToAgentSessionEvent(msg.event);
      processLiveEvent(event);
    });

    const unsubCreated = client.on('session_created', (msg: WsAgentSessionCreatedMessage) => {
      console.log(`[WsIngestion] session_created — newSessionId=${msg.sessionId}`);
      useAgentStore.getState().setCurrentAgentSessionId(msg.sessionId);
      onAgentSessionCreatedRef.current?.(msg.sessionId);
    });

    const unsubStatus = client.on('agent_status', (msg: WsAgentStatusMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      console.log(`[WsIngestion] agent_status — status=${msg.status} msgSession=${msg.sessionId} currentSession=${currentSessionId ?? '(none)'}`);
      if (msg.sessionId !== currentSessionId) return;

      if (msg.status === 'completed' || msg.status === 'aborted') {
        useAgentStore.getState().setConversationStatus('healthy');
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
      unsubSession();
      unsubCreated();
      unsubStatus();
      unsubError();
      unsubBranched();
    };
  }, [client]);
}
