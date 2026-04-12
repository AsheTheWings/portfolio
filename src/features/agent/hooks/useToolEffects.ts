/**
 * useToolEffects - Process UI-side effects from tool executions
 * 
 * Effect Distribution:
 * - Backend handles: appendTurnInstructions, activateWorkflow
 * - UI handles: updateConfig, sessionComponent, userActions
 * 
 * userActions triggers feedback mode via setActiveFeedbackRequest.
 * Backend pauses the agent loop; frontend shows the feedback UI.
 */

import { useCallback } from 'react';
import type { ToolEffectsEvent } from '../types';
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
      store.updateFrontAgentConfig(prev => ({
        ...prev,
        ...toolEffects.updateConfig!,
      }));
    }

    // Handle userActions effect — backend pauses the agent loop;
    // frontend just shows the feedback UI
    if (toolEffects.userActions) {
      store.setActiveFeedbackRequest({
        componentId,
        userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
      });
    }

    // Other session-handled effects (appendTurnInstructions, activateWorkflow)
    // are handled by Agent during event processing - no UI action needed
  }, [store]);
}
