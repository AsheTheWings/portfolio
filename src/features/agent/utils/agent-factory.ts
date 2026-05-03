/**
 * Agent Factory — Pure helpers for creating default agent configs and agents.
 *
 * All model lookups are explicit (pass in modelsById), no mutable module-level
 * registry. This avoids hidden global state and makes the functions testable.
 */

import type { AgentConfig, Agent, ModelSpec } from '../types';
import { ModelCapability } from '../types';

/**
 * Create default agent config for a given modelId.
 * If the model is not in the provided catalog, sensible defaults are returned.
 */
export function createDefaultAgentConfig(
  modelId: string = 'google:gemini-2.5-flash-lite',
  modelsPool: ModelSpec[] = []
): AgentConfig {
  const modelSpec = modelsPool.find(m => m.id === modelId);
  const supportsThinking =
    modelSpec?.capabilities.includes(ModelCapability.THINKING) ?? false;

  return {
    modelId,
    stream: true,
    maxOutputTokens: undefined,
    temperature: 1.0,
    topP: 0.95,
    selectedNativeToolIds: [],
    enableThinking: supportsThinking,
    thinkingBudget: undefined,
    includeThoughtsInResponse: supportsThinking,
    includeThoughtsInContext: true,
    maxModelCalls: 5,
    enableTools: true,
    availableTools: [],
    maxConcurrentTools: 5,
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
