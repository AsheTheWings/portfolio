'use client';

/**
 * useWorkflowSwitcher
 *
 * Single source of truth for changing the active workflow. Used by both
 * the QuickAccessHeader cycle button and the WorkflowSection settings panel.
 *
 * Side effects on switch:
 *   1. Update the store's `selectedWorkflowId` (drives client-side dispatch).
 *   2. Persist to localStorage (survives reload).
 *   3. If a session is active, PATCH `/api/agent/sessions/:id` so the
 *      backend's per-turn dispatch (`session.callAgent` reads
 *      `metadata.workflow`) picks up the change for the next turn.
 *
 * No-op when the requested id matches the current id.
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { saveSelectedWorkflowId } from '../utils/agent-storage';
import { isWorkflowEligible } from '../utils/workflow-eligibility';
import { updateAgentSession } from '../lib/agent-api';

export function useWorkflowSwitcher() {
  const setSelectedWorkflowId = useAgentStore((s) => s.setSelectedWorkflowId);
  const setViewMode = useAgentStore((s) => s.setViewMode);

  const switchTo = useCallback(async (workflowId: string): Promise<void> => {
    const state = useAgentStore.getState();
    if (workflowId === state.selectedWorkflowId) return;

    // Eligibility gate — driven by the workflow's `minAcquiredAgents`. Backend
    // defends in depth (`resolveEffectiveWorkflow` in `agent/session.ts`);
    // this is the primary UX layer that prevents the case from reaching the
    // server. Unknown ids fall through (caller passed garbage) — no-op.
    const workflow = state.workflowsPool.find(w => w.id === workflowId);
    if (!workflow || !isWorkflowEligible(workflow, state.agents)) return;

    // Local state + persistence first — UI is responsive even if PATCH lags.
    setSelectedWorkflowId(workflowId);
    saveSelectedWorkflowId(workflowId);

    // Reset the developer/client compose mode whenever the workflow changes.
    // The developer toggle is mailbox-specific and any staged developer
    // bubble belongs to the previous workflow context — `setViewMode`'s own
    // invariant takes care of clearing `stagedUserMessage` here.
    setViewMode('client');

    // If a session is live, sync server-side metadata so the next turn
    // dispatches against the new workflow.
    const sessionId = state.currentSessionId;
    if (sessionId) {
      try {
        await updateAgentSession(sessionId, { workflow: workflowId });
      } catch (err) {
        console.error('[useWorkflowSwitcher] Failed to update session workflow:', err);
      }
    }
  }, [setSelectedWorkflowId, setViewMode]);

  /**
   * Cycle to the next workflow in `workflowsPool`. Wraps around at the end.
   * No-op if the pool has fewer than two entries.
   */
  const cycle = useCallback(async (): Promise<void> => {
    const { workflowsPool, selectedWorkflowId, agents } = useAgentStore.getState();
    const eligible = workflowsPool.filter(w => isWorkflowEligible(w, agents));
    if (eligible.length < 2) return;
    const idx = eligible.findIndex((w) => w.id === selectedWorkflowId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % eligible.length;
    const next = eligible[nextIdx];
    if (next) await switchTo(next.id);
  }, [switchTo]);

  return { switchTo, cycle };
}
