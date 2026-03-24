'use client';

/**
 * useSessionBranching - Hook for creating branches and reverting to components
 * Handles branch creation, UI rebuild, and agent loop resumption
 */

import { useAgent } from './useAgent';
import { useAgentStore } from '../stores/useAgentStore';
import { toSessionComponents } from '../utils/toSessionComponent';

/**
 * Hook for branching operations (edit submit, revert to component)
 */
export function useSessionBranching() {
  const {
    sessionsManager,
    currentSessionId,
    setCurrentSessionId,
    cancelEdit,
    setSessionComponents,
    setScrollToComponentId,
    resumeAgent,
    stopAgent,
    setError,
  } = useAgent();
  
  const upsertComponent = useAgentStore((s) => s.upsertComponent);

  /**
   * Trigger branch creation with optional data updates and resume agent loop
   */
  const triggerBranch = async (componentId: string, updatedData?: Record<string, unknown>) => {
    if (!currentSessionId) {
      console.error('Cannot trigger branch: no current session');
      return;
    }

    // Stop any running agent loop before switching branch
    stopAgent();

    try {
      // Get current config from store to override stale config in copied events
      const currentConfig = useAgentStore.getState().agentConfig;
      
      // Create branch with optional updated data and fresh config
      const newSession = await sessionsManager.createBranch(
        currentSessionId,
        componentId,
        updatedData,
        currentConfig || undefined
      );

      // Update UI state
      setCurrentSessionId(newSession.metadata.sessionId || null);
      cancelEdit();
      setSessionComponents([]);
      setScrollToComponentId(componentId);

      // Rebuild UI from new session events
      for (const event of newSession.getEvents()) {
        upsertComponent(toSessionComponents(event));
      }

      // Resume agent loop
      await resumeAgent();
    } catch (error: unknown) {
      console.error('Failed to trigger branch:', error);
      setError(error instanceof Error ? error.message : 'Failed to create branch');
    }
  };

  /**
   * Submit edit by triggering branch with updated data
   */
  const submitEdit = async (editingComponentId: string, editingData: Record<string, unknown>) => {
    if (!editingComponentId || !editingData) {
      console.error('Cannot submit edit: missing required data');
      return;
    }

    // Prepare updated data - parse arguments if string (component validates it)
    const updatedData: Record<string, unknown> = {};

    if (editingData.message !== undefined) {
      updatedData.message = editingData.message;
    }

    if (editingData.arguments !== undefined) {
      updatedData.arguments = typeof editingData.arguments === 'string'
        ? JSON.parse(editingData.arguments) // Component guarantees valid JSON
        : editingData.arguments;
    }

    if (editingData.result !== undefined) {
      updatedData.result = editingData.result;
    }

    // Trigger branch with updated data
    await triggerBranch(editingComponentId, updatedData);
  };

  /**
   * Revert to component by triggering branch without modifications
   */
  const revertToComponent = async (componentId: string) => {
    await triggerBranch(componentId);
  };

  return {
    triggerBranch,
    submitEdit,
    revertToComponent,
  };
}
