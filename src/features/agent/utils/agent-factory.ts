/**
 * Agent Factory — Pure helpers for creating default agent configs and agents.
 *
 * All model lookups are explicit (pass in modelsById), no mutable module-level
 * registry. This avoids hidden global state and makes the functions testable.
 */

import type { AgentConfig, Agent, ModelSpec } from '../types';

const FALLBACK_MODEL_ID = 'google/gemini-2.5-flash';
const FALLBACK_PROVIDER_ID = 'openrouter';

/**
 * Create default agent config for a given model id.
 * If no id is provided, use the first catalog model, then a stable fallback.
 */
export function createDefaultAgentConfig(
  modelId?: string,
  modelsPool: ModelSpec[] = []
): AgentConfig {
  const selectedModel = modelId
    ? modelsPool.find((model) => model.id === modelId)
    : modelsPool[0];

  return {
    modelId: modelId ?? selectedModel?.id ?? FALLBACK_MODEL_ID,
    providerId: selectedModel?.providerId ?? FALLBACK_PROVIDER_ID,
    stream: true,
    maxModelCalls: 5,
    enableTools: true,
    availableTools: [],
    maxConcurrentTools: 5,
    providerParameters: {
      temperature: 1,
      top_p: 0.95,
    },
  };
}

/**
 * Create the built-in 'Assistant' agent (agentId: 'none').
 */
export function createAssistantAgent(
  modelId?: string,
  modelsPool: ModelSpec[] = []
): Agent {
  return {
    agentId: 'none',
    config: createDefaultAgentConfig(modelId, modelsPool),
  };
}
