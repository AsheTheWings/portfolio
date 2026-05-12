/**
 * Agent Factory — Pure helpers for creating default agent configs and agents.
 *
 * All model lookups are explicit (pass in modelsById), no mutable module-level
 * registry. This avoids hidden global state and makes the functions testable.
 */

import type { AgentConfig, Agent, ModelSpec } from '../types';

const FALLBACK_MODEL_ID = 'google/gemini-2.5-flash';
const FALLBACK_PROVIDER_ID = 'openrouter';

function selectDefaultModel(modelId: string | undefined, modelsPool: ModelSpec[]): ModelSpec | undefined {
  if (modelsPool.length === 0) return undefined;
  return (modelId ? modelsPool.find((model) => model.id === modelId) : undefined) ?? modelsPool[0];
}

/**
 * Create default agent config for a given model id.
 * Once a catalog is available, the returned model id is always from that catalog.
 * Before catalog hydration, preserve an explicit id and otherwise use a stable fallback.
 */
export function createDefaultAgentConfig(
  modelId?: string,
  modelsPool: ModelSpec[] = []
): AgentConfig {
  const selectedModel = selectDefaultModel(modelId, modelsPool);

  return {
    modelId: selectedModel?.id ?? modelId ?? FALLBACK_MODEL_ID,
    providerId: selectedModel?.providerId ?? FALLBACK_PROVIDER_ID,
    stream: true,
    maxModelCalls: 5,
    enableTools: true,
    availableTools: [],
    maxConcurrentTools: 5,
    providerParameters: {},
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
