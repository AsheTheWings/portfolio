/**
 * useToolEffects - Process UI-side effects from tool executions
 * 
 * Effect Distribution:
 * - Backend handles: setBackgroundMode, setActiveJob, appendTurnInstructions, activateWorkflow
 * - UI handles: updateConfig, sessionComponent, userActions
 * 
 * userActions triggers feedback mode via setActiveFeedbackRequest.
 * Backend pauses the agent loop; frontend shows the feedback UI.
 */

import { useCallback } from 'react';
import type { ToolEffectsEvent, AgentConfig, AgentSessionComponent } from '../types';
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

    // Handle userActions effect — backend pauses the agent loop;
    // frontend just shows the feedback UI
    if (toolEffects.userActions) {
      store.setActiveFeedbackRequest({
        componentId,
        userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
      });
    }

    // Sync active job to store (Session handles event stamping, store provides UI state)
    if (toolEffects.setActiveJob) {
      store.setActiveJob(toolEffects.setActiveJob.job);
    }

    // Other session-handled effects (appendTurnInstructions, activateWorkflow)
    // are handled by Agent during event processing - no UI action needed
  }, [store]);
}
