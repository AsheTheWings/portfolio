/**
 * Shared live event processor.
 *
 * Handles a single WS session_event: upserts the component, applies tool
 * effects (config, feedback, active job), and derives conversation status.
 *
 * Used by both useWsEventIngestion (live path) and loadAgentSession (buffer replay).
 */

import { useAgentStore } from '../stores/useAgentStore';
import type { AgentSessionEvent, AgentConfig, ToolEffectsData } from '../types';

export function processLiveEvent(event: AgentSessionEvent) {
  const store = useAgentStore.getState();

  // 1. Upsert component
  store.upsertComponentFromEvent(event);

  // 2. Handle tool-effects side-effects
  if (event.type === 'tool-effects') {
    const { toolEffects } = event.data as ToolEffectsData;
    if (toolEffects && Object.keys(toolEffects).length > 0) {
      if (toolEffects.updateConfig) {
        const current = useAgentStore.getState().agentConfig || {};
        useAgentStore.getState().setAgentConfig({
          ...current,
          ...toolEffects.updateConfig,
        } as AgentConfig);
      }
      if (toolEffects.userActions) {
        useAgentStore.getState().setActiveFeedbackRequest({
          componentId: event.componentId,
          userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
        });
        useAgentStore.getState().setConversationStatus('waitingFeedback');
      }
      if (toolEffects.setActiveJob) {
        useAgentStore.getState().setActiveJob(toolEffects.setActiveJob.job);
      }
    }
  }

  // 3. Derive conversation status from event type
  switch (event.type) {
    case 'model-thought-chunk':
      store.setConversationStatus('thinking');
      break;
    case 'model-message-chunk':
      store.setConversationStatus('responding');
      break;
    case 'tool-call':
      store.setConversationStatus('toolCalling');
      break;
    case 'agent-turn-completed':
      store.setConversationStatus('healthy');
      break;
    case 'user-turn-completed':
      store.setConversationStatus('processing');
      break;
  }
}
