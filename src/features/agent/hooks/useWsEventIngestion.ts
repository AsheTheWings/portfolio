'use client';

/**
 * useWsEventIngestion - Central WS event handler
 *
 * Listens to all server→client WS messages and routes them:
 * - session_event  → store.upsertComponentFromEvent + side-effects
 * - session_created → store.setCurrentAgentSessionId + URL update
 * - agent_status   → store.setConversationStatus
 * - error          → store.setError
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { toastError } from '@/features/shared/components/FeedbackMessage';
import type { AgentSessionEvent, ToolEffectsEvent, AgentConfig } from '../types';
import type {
  WsAgentSessionEventMessage,
  WsAgentSessionCreatedMessage,
  WsAgentStatusMessage,
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
}

export function useWsEventIngestion(options?: UseWsEventIngestionOptions) {
  const { client } = useAgentConnection();
  const store = useAgentStore();
  const onAgentSessionCreatedRef = useRef(options?.onAgentSessionCreated);
  onAgentSessionCreatedRef.current = options?.onAgentSessionCreated;

  // Handle tool-effects side-effects (config updates, feedback mode, active job)
  const handleToolEffects = useCallback((event: ToolEffectsEvent) => {
    const { toolEffects } = event.data;
    if (!toolEffects || Object.keys(toolEffects).length === 0) return;

    if (toolEffects.updateConfig) {
      const currentConfig = useAgentStore.getState().agentConfig || {};
      const updatedConfig: AgentConfig = {
        ...currentConfig,
        ...toolEffects.updateConfig,
      } as AgentConfig;
      useAgentStore.getState().setAgentConfig(updatedConfig);
    }

    if (toolEffects.userActions) {
      useAgentStore.getState().setActiveFeedbackRequest({
        componentId: event.componentId,
        userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
      });
      useAgentStore.getState().setConversationStatus('waitingFeedback');
    }

    if (toolEffects.setActiveJob) {
      useAgentStore.getState().setActiveJob(toolEffects.setActiveJob.job);
    }
  }, []);

  // Derive conversation status from event type
  const deriveStatusFromEvent = useCallback((event: AgentSessionEvent) => {
    const type = event.type;
    if (type === 'model-thought-chunk') {
      useAgentStore.getState().setConversationStatus('thinking');
    } else if (type === 'model-message-chunk') {
      useAgentStore.getState().setConversationStatus('responding');
    } else if (type === 'tool-call') {
      useAgentStore.getState().setConversationStatus('toolCalling');
    } else if (type === 'agent-turn-completed') {
      useAgentStore.getState().setConversationStatus('healthy');
    } else if (type === 'user-turn-completed') {
      useAgentStore.getState().setConversationStatus('processing');
    }
    // tool-effects with userActions handled in handleToolEffects
  }, []);

  useEffect(() => {
    if (!client) return;

    const unsubSession = client.on('session_event', (msg: WsAgentSessionEventMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
      // Only process events for the active session
      if (msg.sessionId !== currentSessionId) return;

      const event = wireToAgentSessionEvent(msg.event);

      // Route to store
      useAgentStore.getState().upsertComponentFromEvent(event);

      // Side-effects
      if (event.type === 'tool-effects') {
        handleToolEffects(event as ToolEffectsEvent);
      }

      // Derive conversation status
      deriveStatusFromEvent(event);
    });

    const unsubCreated = client.on('session_created', (msg: WsAgentSessionCreatedMessage) => {
      useAgentStore.getState().setCurrentAgentSessionId(msg.sessionId);
      onAgentSessionCreatedRef.current?.(msg.sessionId);
    });

    const unsubStatus = client.on('agent_status', (msg: WsAgentStatusMessage) => {
      const currentSessionId = useAgentStore.getState().currentSessionId;
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

    return () => {
      unsubSession();
      unsubCreated();
      unsubStatus();
      unsubError();
    };
  }, [client, handleToolEffects, deriveStatusFromEvent]);
}
