/**
 * Canonical app-owned model registry contract — frontend mirror.
 *
 * Mirrors the backend `ModelSpec` shape exactly. The frontend MUST NOT
 * accept OpenRouter SDK / provider-internal fields (pricing, tokenizer,
 * raw architecture, top provider, links, slugs, descriptions, default
 * parameters, knowledge cutoff, etc.).
 */

export type ModelParameterType = 'number' | 'integer' | 'boolean' | 'string' | 'string[]' | 'enum' | 'object';
export type ModelParameterApiSurface = 'openai-chat-completions' | 'openrouter-chat-completions' | 'openai-responses';

/** Wire protocol a custom provider speaks. */
export type LlmApiSurface = 'chat_completions' | 'responses';

export interface ModelParameterSchema {
  key: string;
  label: string;
  description: string;
  type: ModelParameterType;
  apiSurfaces: ModelParameterApiSurface[];
  hidden?: boolean;
  default?: unknown;
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: string; label: string }>;
  };
  control?: 'input' | 'slider' | 'select' | 'tri-state' | 'tags' | 'reasoning-budget';
}

export interface ModelSpec {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  contextLength: number | null;
  maxCompletionTokens: number | null;
  supportedParameters: string[];
  inputModalities: string[];
  apiSurface?: LlmApiSurface;
}

/**
 * Canonical registry response (contractVersion 5).
 *
 * `parameters` is an ordered array. The order in which parameters appear
 * IS the rendering contract — clients render visible parameters in this
 * order, intersected with `ModelSpec.supportedParameters` and filtered by
 * `schema.hidden`.
 */
export interface LlmRegistrySnapshot {
  contractVersion: 5;
  models: ModelSpec[];
  defaultModelId: string;
  parameters: ModelParameterSchema[];
  refreshedAt: string | null;
}

/** Custom provider model input as submitted by the settings UI. */
export interface CustomProviderModelInput {
  id: string;
  name?: string;
  contextLength?: number | null;
  maxCompletionTokens?: number | null;
  inputModalities?: string[];
}

/** Custom provider settings as exposed by `/settings/model-providers`. */
export interface UserModelProviderSettings {
  id: string;
  provider: string;
  baseURL: string;
  headers: Record<string, string>;
  enabled: boolean;
  hasApiKey: boolean;
  apiSurface: LlmApiSurface;
  models: ModelSpec[];
  createdAt: string;
  updatedAt: string;
}
