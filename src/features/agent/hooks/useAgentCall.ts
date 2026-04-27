'use client';

/**
 * useAgentCall Hook
 * 
 * Thin WS sender — all agent execution happens on the backend.
 * - submitMessage(): sends user_message via WS
 * - stopAgent(): sends stop_agent via WS
 * - submitFeedback(): sends submit_feedback via WS  
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';

export function useAgentCall() {
  const { send } = useAgentConnection();

  /**
   * Send user message to backend via WS.
   * If no sessionId exists, backend creates a new session (session_created msg)
   * using the workflow id carried in the payload.
   */
  const submitMessage = useCallback((
    message: string,
    libraryItemIds?: string[]
  ) => {
    const store = useAgentStore.getState();

    console.log(`[AgentCall] submitMessage — sessionId=${store.currentSessionId ?? '(none)'} message="${message.slice(0, 60)}..."`);

    // Clear system panels when user sends a new message
    store.clearSystemPanels();
    // Mark every configured agent as 'processing' so each bubble lights up
    // while waiting for its first model event.
    store.resetAllAgentStatuses('processing');

    // Track in user messages history
    store.appendToUserMessagesHistory(message);

    // `selectedWorkflowId` is resolved to the registry default during hydration
    // (see useHydrateStore). If it's still empty here, the backend will apply
    // its own registry default. The agents array is forwarded verbatim — the
    // backend owns all roster-shaping rules.
    send({
      type: 'user_message',
      sessionId: store.currentSessionId ?? undefined,
      data: {
        message,
        agents: store.agents.map(a => ({ agentId: a.agentId, config: a.config })),
        workflow: store.selectedWorkflowId || undefined,
        libraryItemIds,
      },
    });
  }, [send]);

  /**
   * Stop current agent execution on backend
   */
  const stopAgent = useCallback(() => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;
    
    send({
      type: 'stop_agent',
      sessionId,
    });
  }, [send]);

  /**
   * Submit feedback result to backend via WS
   */
  const submitFeedback = useCallback((
    toolCallEventId: string,
    feedbackData: Record<string, unknown>
  ) => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;
    
    // Clear feedback UI state
    useAgentStore.getState().clearActiveFeedbackRequest();
    
    send({
      type: 'submit_feedback',
      sessionId,
      toolCallEventId,
      feedbackData,
    });
  }, [send]);

  /**
   * Resume agent from last state — no new input, re-run from where it stopped
   */
  const resumeAgent = useCallback(() => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;

    useAgentStore.getState().resetAllAgentStatuses('processing');

    send({
      type: 'resume_agent',
      sessionId,
    });
  }, [send]);

  return {
    submitMessage,
    stopAgent,
    submitFeedback,
    resumeAgent,
  };
}
