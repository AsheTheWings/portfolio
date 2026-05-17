/**
 * Agent Factory — pure helpers for default agent configs.
 *
 * Operates only over the canonical `ModelSpec` contract. Selection lookups
 * use `(providerId, modelId)` tuples to avoid id collisions across
 * providers; falls back to `defaultModelId` (preferred) then the first
 * pool entry (last-resort initial state).
 */

import type { Agent, AgentConfig } from '../types/session';
import type { ModelSpec } from '../types/llm';

const FALLBACK_MODEL_ID = 'moonshotai/kimi-k2.6';
const FALLBACK_PROVIDER_ID = 'openrouter';

function selectInitialModel(
  preferredModelId: string | undefined,
  modelsPool: ModelSpec[],
): ModelSpec | undefined {
  if (modelsPool.length === 0) return undefined;
  if (preferredModelId) {
    const exact = modelsPool.find((m) => m.id === preferredModelId);
    if (exact) return exact;
  }
  return modelsPool[0];
}

/**
 * Build an initial agent config. Once a registry is available, the resolved
 * `(providerId, modelId)` is always taken from it. Pre-hydration we keep an
 * explicit id (or a stable fallback) so the picker can still render.
 */
export function createDefaultAgentConfig(
  preferredModelId?: string,
  modelsPool: ModelSpec[] = [],
): AgentConfig {
  const selected = selectInitialModel(preferredModelId, modelsPool);

  return {
    modelId: selected?.id ?? preferredModelId ?? FALLBACK_MODEL_ID,
    providerId: selected?.providerId ?? FALLBACK_PROVIDER_ID,
    stream: true,
    maxModelCalls: 5,
    enableTools: true,
    availableTools: [],
    maxConcurrentTools: 5,
    providerParameters: {},
  };
}

/** Built-in 'Assistant' agent (agentId: 'none'). */
export function createAssistantAgent(
  preferredModelId?: string,
  modelsPool: ModelSpec[] = [],
): Agent {
  return {
    agentId: 'none',
    config: createDefaultAgentConfig(preferredModelId, modelsPool),
  };
}
