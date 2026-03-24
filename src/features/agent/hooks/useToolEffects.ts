/**
 * useToolEffects - Process UI-side effects from tool executions
 * 
 * Effect Distribution:
 * - Session/Agent handles: setBackgroundMode, setActiveJob, appendTurnInstructions, activateWorkflow
 * - UI handles: updateConfig, sessionComponent, userActions
 * 
 * userActions triggers feedback mode via setActiveFeedbackRequest + stopAgent.
 * This is symmetric with resumeAgent() called after feedback submission.
 */

import { useCallback } from 'react';
import type { ToolEffectsEvent, AgentConfig, SessionComponent } from '../types';
import { useAgentStore } from '../stores/useAgentStore';

export function useToolEffects() {
  const store = useAgentStore();

  return useCallback((event: ToolEffectsEvent) => {
    const { toolEffects } = event.data;
    const { componentId } = event;
    
    if (!toolEffects || Object.keys(toolEffects).length === 0) {
      return;
    }

    // Handle updateConfig effect
    if (toolEffects.updateConfig) {
      const currentConfig = store.agentConfig || {};
      const updatedConfig: AgentConfig = {
        ...currentConfig,
        ...toolEffects.updateConfig,
      } as AgentConfig;
      
      store.setAgentConfig(updatedConfig);

      // Persist to localStorage
      try {
        localStorage.setItem('agentConfig', JSON.stringify(updatedConfig));
      } catch (err) {
        console.warn('Failed to persist config to localStorage:', err);
      }
    }

    // Handle userActions effect
    if (toolEffects.userActions) {
      // Trigger feedback mode and stop agent loop
      // Symmetric with resumeAgent() called after feedback submission
      store.setActiveFeedbackRequest({
        componentId,
        userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
      });
      store.stopAgent();
    }

    // Sync active job to store (Session handles event stamping, store provides UI state)
    if (toolEffects.setActiveJob) {
      store.setActiveJob(toolEffects.setActiveJob.job);
    }

    // Other session-handled effects (appendTurnInstructions, activateWorkflow)
    // are handled by Agent during event processing - no UI action needed
  }, [store]);
}
