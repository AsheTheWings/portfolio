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
 *   3. If a session is active, persist the workflow through the canonical
 *      Agentime client so the next turn uses the new workflow.
 *
 * No-op when the requested id matches the current id.
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { saveSelectedWorkflowId } from '../utils/agent-storage';
import { agentimeHttp } from '../lib/agentime-client';
import { withHttpProblem } from '../problems/http';

export function useWorkflowSwitcher() {
  const setSelectedWorkflowId = useAgentStore((s) => s.setSelectedWorkflowId);
  const setUserMode = useAgentStore((s) => s.setUserMode);

  const switchTo = useCallback(async (workflowId: string): Promise<void> => {
    const state = useAgentStore.getState();
    if (workflowId === state.selectedWorkflowId) return;

    const workflow = state.workflowsPool.find(w => w.id === workflowId);
    if (!workflow) return;

    // Local state + persistence first — UI is responsive even if PATCH lags.
    setSelectedWorkflowId(workflowId);
    saveSelectedWorkflowId(workflowId);
  
    setUserMode('client');

    // If a session is live, sync server-side metadata so the next turn
    // dispatches against the new workflow.
    const sessionId = state.currentSessionId;
    if (sessionId) {
      try {
        await withHttpProblem(
          () => agentimeHttp.updateSession(sessionId, { workflow: workflowId }),
          'session',
          'workflow-switch',
        );
      } catch {}
    }
  }, [setSelectedWorkflowId, setUserMode]);

  /**
   * Cycle to the next workflow in `workflowsPool`. Wraps around at the end.
   * No-op if the pool has fewer than two entries.
   */
  const cycle = useCallback(async (): Promise<void> => {
    const { workflowsPool, selectedWorkflowId } = useAgentStore.getState();
    if (workflowsPool.length < 2) return;
    const idx = workflowsPool.findIndex((w) => w.id === selectedWorkflowId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % workflowsPool.length;
    const next = workflowsPool[nextIdx];
    if (next) await switchTo(next.id);
  }, [switchTo]);

  return { switchTo, cycle };
}
