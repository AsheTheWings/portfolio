/**
 * Models Registry — Dynamic model registry for the frontend.
 *
 * Models are fetched from the backend (which discovers them from Google/Fireworks
 * APIs) and stored in the Zustand store as `modelsPool`. This module provides
 * utility functions that read from a synced module-level map.
 *
 * To avoid circular deps (store imports this module), the store calls
 * `syncModelsRegistry(models)` whenever `modelsPool` changes. All lookups
 * read from the synced map.
 *
 * Before models are loaded (SSR or initial render), functions return safe
 * defaults: hasCapability → false, getModelSpec → undefined, etc.
 */

import type {
  AgentConfig,
  Agent,
  NativeTool,
  ModelSpec,
  ModelCapability,
} from '../types';

import { ModelCapability as MC } from '../types';

// ============================================================
// Module-level model map (synced from store.modelsPool)
// ============================================================

const _models: Record<string, ModelSpec> = {};

/**
 * Sync the module-level lookup map with the store's modelsPool.
 * Called by useAgentStore.setModelsPool().
 */
export function syncModelsRegistry(models: ModelSpec[]): void {
  for (const key of Object.keys(_models)) {
    delete _models[key];
  }
  for (const m of models) {
    _models[m.id] = m;
  }
}

/**
 * Read-only reference to the current models map.
 * Use for iterating all models (e.g. Object.values(MODEL_REGISTRY)).
 */
export const MODEL_REGISTRY: Readonly<Record<string, ModelSpec>> = _models;

// ============================================================
// Utility Functions
// ============================================================

export function getModelSpec(modelId: string): ModelSpec | undefined {
  return _models[modelId];
}

export function getProviderModels(provider: string): ModelSpec[] {
  return Object.values(_models).filter((m) => m.provider === provider);
}

export function getAvailableProviders(): string[] {
  return Array.from(
    new Set(Object.values(_models).map((m) => m.provider))
  );
}

export function hasCapability(
  modelId: string,
  capability: ModelCapability
): boolean {
  const spec = getModelSpec(modelId);
  return spec?.capabilities.includes(capability) ?? false;
}

export function getModelNativeTools(modelId: string): NativeTool[] {
  const spec = getModelSpec(modelId);
  return spec?.nativeTools ?? [];
}

/**
 * Create default agent config.
 * Works before models are loaded — returns sensible defaults.
 */
export function createDefaultAgentConfig(
  modelId: string = 'gemini-2.5-flash-lite'
): AgentConfig {
  const modelSpec = getModelSpec(modelId);
  const supportsThinking =
    modelSpec?.capabilities.includes(MC.THINKING) ?? false;

  return {
    provider: modelSpec?.provider || 'google',
    model: modelId,
    stream: true,
    maxOutputTokens: undefined,
    temperature: 1.0,
    topP: 0.95,
    selectedNativeTools: [],
    enableThinking: supportsThinking,
    thinkingBudget: undefined,
    includeThoughtsInResponse: supportsThinking,
    includeThoughtsInContext: true,
    maxModelCalls: 5,
    enableTools: true,
    availableTools: [],
    maxConcurrentTools: 5,
    enableWorkflows: true,
    selectedWorkflows: [],
  };
}

/**
 * Create the built-in 'Assistant' agent (agentId: 'none').
 */
export function createAssistantAgent(modelId?: string): Agent {
  return {
    agentId: 'none',
    config: createDefaultAgentConfig(modelId),
  };
}

export function isValidModel(modelId: string): boolean {
  return modelId in _models;
}

export function getDefaultModelForProvider(provider: string): string | null {
  const models = getProviderModels(provider);
  if (models.length === 0) return null;
  return models[0].id;
}
