'use client';

/**
 * useWorkflow — Workflow run control surface.
 *
 * Thin WS sender wrapping the run-lifecycle verbs. Every method dispatches
 * over the WebSocket and returns immediately; lifecycle truth flows back
 * through `session_event` (workflow_started, workflow_paused, …) which the
 * store ingests in `appendEvent`. Optimistic store nudges in this file are
 * just for snappy UI feedback — they are reconciled by the next event.
 *
 *   submitMessage   → user_message    (starts a new run on commit)
 *   abortWorkflow   → abort_workflow  (cancels the active run)
 *   submitFeedback  → submit_feedback (resumes a paused run with a result)
 *   resumeWorkflow  → resume_workflow (resumes a paused run with no input)
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';

export function useWorkflow() {
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
    // Optimistic UI: snap to running before workflow_started lands.
    // The lifecycle handler in `appendEvent` is idempotent on the
    // workflow_started event we'll receive shortly.
    store.setWorkflowStatus('running');
    store.resetAllAgentStatuses('processing');

    // Track in user messages history
    store.appendToUserMessagesHistory(message);

    // `selectedWorkflowId` is resolved to the registry default during hydration
    // (see useHydrateStore). If it's still empty here, the backend will apply
    // its own registry default. Re-route through setAgents immediately before
    // dispatch so every outbound agent config uses a catalog-valid model id.
    store.setAgents(store.agents);
    const agents = useAgentStore.getState().agents;

    send({
      type: 'user_message',
      sessionId: store.currentSessionId ?? undefined,
      data: {
        message,
        agents: agents.map(a => ({ agentId: a.agentId, config: a.config })),
        workflow: store.selectedWorkflowId || undefined,
        libraryItemIds,
      },
    });
  }, [send]);

  /**
   * Abort the active workflow run on the backend. Emits `workflow_aborted`
   * which transitions WorkflowStatus to 'aborted' and every active agent
   * to 'aborted'.
   */
  const abortWorkflow = useCallback(() => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;

    send({
      type: 'abort_workflow',
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

    send({
      type: 'submit_feedback',
      sessionId,
      toolCallEventId,
      feedbackData,
    });
  }, [send]);

  /**
   * Resume the paused run with no additional input — reuses the same
   * runId. Emits `workflow_resumed` server-side which lands on the
   * lifecycle handler in `appendEvent`.
   */
  const resumeWorkflow = useCallback(() => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) return;

    // Optimistic UI: see `submitMessage` for rationale.
    store.setWorkflowStatus('running');
    store.resetAllAgentStatuses('processing');

    send({
      type: 'resume_workflow',
      sessionId,
    });
  }, [send]);

  return {
    submitMessage,
    abortWorkflow,
    submitFeedback,
    resumeWorkflow,
  };
}
