/**
 * LLM/model registry types.
 *
 * Mirrors the backend agent/types/llm.ts contract for model catalogs and
 * parameter schema metadata consumed by the frontend.
 */

// Frontend-derived OpenRouter capability labels.
export enum ModelCapability {
  THINKING = 'thinking',
  VISION = 'vision',
  IMAGE_GENERATION = 'image_generation',
  TOOL_CALLING = 'tool_calling',
  STRUCTURED_OUTPUT = 'structured_output',
}

export type ModelParameterType = 'number' | 'integer' | 'boolean' | 'string' | 'string[]' | 'enum' | 'object';
export type ModelParameterApiSurface = 'openai-chat-completions' | 'openrouter-chat-completions';

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
  group?: 'sampling' | 'penalties' | 'reasoning' | 'output' | 'advanced';
}

// Model object returned by the backend model registry.
export interface ModelSpec {
  id: string;
  name?: string;
  displayName?: string;
  provider?: string;
  providerId?: string;
  providerName?: string;
  source?: 'built-in' | 'custom';
  context_length?: number | null;
  contextLength?: number | null;
  maxTokens?: number;
  default_parameters?: Record<string, unknown> | null;
  defaultParameters?: Record<string, unknown> | null;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
    inputModalities?: string[];
    outputModalities?: string[];
    instructType?: string | null;
    [key: string]: unknown;
  };
  supported_parameters?: string[];
  supportedParameters?: string[];
  pricing?: Record<string, unknown>;
  top_provider?: Record<string, unknown>;
  topProvider?: Record<string, unknown>;
  [key: string]: unknown;
}
