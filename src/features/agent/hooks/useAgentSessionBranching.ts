'use client';

/**
 * useAgentSessionBranching - Hook for creating branches via REST
 * Handles branch creation, session reload, and WS re-subscription
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentConnection } from './useAgentConnection';
import { useAgentSessionLifecycle } from './useAgentSessionLifecycle';
import { branchAgentSession } from '../lib/agent-api';

export function useAgentSessionBranching() {
  const { send } = useAgentConnection();
  const { loadAgentSession } = useAgentSessionLifecycle();

  /**
   * Create a branch at a component and load the new session
   */
  const triggerBranch = useCallback(async (
    componentId: string,
    updatedData?: Record<string, unknown>
  ) => {
    const store = useAgentStore.getState();
    const sessionId = store.currentSessionId;
    if (!sessionId) {
      console.error('Cannot trigger branch: no current session');
      return;
    }

    try {
      // Stop receiving events for old session
      send({ type: 'stop_agent', sessionId });
      send({ type: 'unsubscribe', sessionId });

      // Create branch via REST
      const agentConfig = store.agentConfig ?? undefined;
      const result = await branchAgentSession(sessionId, componentId, updatedData, agentConfig);

      // Cancel any editing state
      store.cancelEdit();
      store.setScrollToComponentId(componentId);

      // Load the new branch session (fetches events + subscribes to WS)
      await loadAgentSession(result.sessionId);
    } catch (error: unknown) {
      console.error('Failed to trigger branch:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to create branch');
    }
  }, [send, loadAgentSession]);

  /**
   * Submit edit by triggering branch with updated data
   */
  const submitEdit = useCallback(async (
    editingComponentId: string,
    editingData: Record<string, unknown>
  ) => {
    if (!editingComponentId || !editingData) {
      console.error('Cannot submit edit: missing required data');
      return;
    }

    const updatedData: Record<string, unknown> = {};

    if (editingData.message !== undefined) {
      updatedData.message = editingData.message;
    }

    if (editingData.arguments !== undefined) {
      updatedData.arguments = typeof editingData.arguments === 'string'
        ? JSON.parse(editingData.arguments)
        : editingData.arguments;
    }

    if (editingData.result !== undefined) {
      updatedData.result = editingData.result;
    }

    await triggerBranch(editingComponentId, updatedData);
  }, [triggerBranch]);

  /**
   * Revert to component by triggering branch without modifications
   */
  const revertToComponent = useCallback(async (componentId: string) => {
    await triggerBranch(componentId);
  }, [triggerBranch]);

  return {
    triggerBranch,
    submitEdit,
    revertToComponent,
  };
}
