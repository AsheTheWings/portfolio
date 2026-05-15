/**
 * Strict helpers over the canonical `ModelSpec` registry contract.
 *
 * These functions never touch OpenRouter-shaped fields. UI-facing
 * "capability" facts are derived directly from `supportedParameters` and
 * `inputModalities` per the spec.
 */

import type { ModelSpec } from '../types/llm';

export function getModelDisplayName(model: ModelSpec | undefined): string {
  return model?.name ?? '';
}

/** Opaque routing identifier. `openrouter` for built-in, UUID for custom. */
export function getModelProvider(model: ModelSpec): string {
  return model.providerId;
}

/** User-facing provider display name used for picker grouping. */
export function getModelProviderName(model: ModelSpec): string {
  return model.provider;
}

export function getModelContextLength(model: ModelSpec | undefined): number | undefined {
  return model?.contextLength ?? undefined;
}

export function getModelMaxCompletionTokens(model: ModelSpec | undefined): number | undefined {
  return model?.maxCompletionTokens ?? undefined;
}

export function getModelSupportedParameters(model: ModelSpec | undefined): Set<string> {
  return new Set(model?.supportedParameters ?? []);
}

export function modelSupportsParameter(model: ModelSpec | undefined, parameter: string): boolean {
  return Boolean(model?.supportedParameters?.includes(parameter));
}

export function modelSupportsInputModality(model: ModelSpec | undefined, modality: string): boolean {
  return Boolean(model?.inputModalities?.includes(modality));
}

// ============================================================
// Derived UI facts
// ============================================================

export function modelSupportsTools(model: ModelSpec | undefined): boolean {
  return modelSupportsParameter(model, 'tools');
}

export function modelSupportsReasoning(model: ModelSpec | undefined): boolean {
  return ['reasoning', 'reasoning_effort', 'include_reasoning']
    .some((key) => modelSupportsParameter(model, key));
}

export function modelSupportsStructuredOutput(model: ModelSpec | undefined): boolean {
  return ['response_format', 'structured_outputs']
    .some((key) => modelSupportsParameter(model, key));
}

export function modelSupportsVision(model: ModelSpec | undefined): boolean {
  return modelSupportsInputModality(model, 'image');
}

export function modelSupportsFileInput(model: ModelSpec | undefined): boolean {
  return modelSupportsInputModality(model, 'file');
}

/**
 * Compact list of UI capability badges derived from a `ModelSpec`. Order is
 * stable and matches the spec's derivation table.
 */
export function getModelCapabilityBadges(model: ModelSpec | undefined): string[] {
  if (!model) return [];
  const badges: string[] = [];
  if (modelSupportsReasoning(model)) badges.push('Thinking');
  if (modelSupportsVision(model)) badges.push('Vision');
  if (modelSupportsTools(model)) badges.push('Tools');
  if (modelSupportsStructuredOutput(model)) badges.push('Structured Output');
  return badges;
}
