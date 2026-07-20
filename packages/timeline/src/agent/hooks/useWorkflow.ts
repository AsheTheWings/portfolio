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
import type { JsonValue } from '@agentime/protocol';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { runScopedCommand } from '../problems/commands';

export function useWorkflow() {
  const { command } = useAgentConnection();

  /**
   * Send user message to backend via WS.
   * If no sessionId exists, the backend creates a session and accepts the workflow.
   * using the workflow id carried in the payload.
   */
  const submitMessage = useCallback((
    message: string,
    libraryItemIds?: string[]
  ) => {
    const store = useAgentStore.getState();

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

    void runScopedCommand(command, {
        type: 'user_message',
        sessionId: store.currentSessionId ?? undefined,
        data: {
          message,
          agents: agents.map(a => ({ agentId: a.agentId })),
          workflow: store.selectedWorkflowId || undefined,
          libraryItemIds,
        },
        runOptions: {
          persist: store.persistSession,
          ephemeral: store.ephemeral,
        },
      }, 'composer').then((accepted) => {
        if (accepted.type === 'workflow_accepted' && !store.currentSessionId) {
          store.setCurrentSessionId(accepted.sessionId);
        }
      }).catch(() => {
      store.setWorkflowStatus('idle');
      store.resetAllAgentStatuses('idle');
    });
  }, [command]);

  /**
   * Abort the active workflow run on the backend. Emits `workflow_aborted`
   * which transitions WorkflowStatus to 'aborted' and every active agent
   * to 'aborted'.
   */
  const abortWorkflow = useCallback(() => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;

    void runScopedCommand(command, {
      type: 'abort_workflow',
      sessionId,
    }, 'workflow-abort').catch(() => undefined);
  }, [command]);

  /**
   * Submit feedback result to backend via WS
   */
  const submitFeedback = useCallback((
    toolCallEventId: string,
    feedbackData: JsonValue
  ) => {
    const sessionId = useAgentStore.getState().currentSessionId;
    if (!sessionId) return;

    void runScopedCommand(command, {
      type: 'submit_feedback',
      sessionId,
      toolCallEventId,
      feedbackData,
    }, `tool-feedback:${toolCallEventId}`).catch(() => undefined);
  }, [command]);

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

    void runScopedCommand(command, {
      type: 'resume_workflow',
      sessionId,
    }, 'workflow-resume').catch(() => {
      store.setWorkflowStatus('paused');
    });
  }, [command]);

  return {
    submitMessage,
    abortWorkflow,
    submitFeedback,
    resumeWorkflow,
  };
}
