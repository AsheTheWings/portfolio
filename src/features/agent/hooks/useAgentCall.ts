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
   * If no sessionId exists, backend creates a new session (session_created msg).
   * Workflow is derived from agent configuration:
   * - 'timeline' when any non-assistant agent is present in the agents array
   * - 'default' for assistant-only sessions
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

    // Resolve workflow: timeline when any non-assistant agent is active
    const hasNonAssistantAgent = store.agents.some(a => a.agentId !== 'none');
    const workflow: 'default' | 'timeline' = hasNonAssistantAgent ? 'timeline' : 'default';

    send({
      type: 'user_message',
      sessionId: store.currentSessionId ?? undefined,
      data: {
        message,
        agents: store.agents.map(a => ({ agentId: a.agentId, config: a.config })),
        workflow,
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
