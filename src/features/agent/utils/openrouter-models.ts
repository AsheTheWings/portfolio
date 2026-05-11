import { ModelCapability, type ModelSpec } from '../types';

function firstString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function getModelDisplayName(model: ModelSpec | undefined): string {
  if (!model) return '';
  return firstString(model.name) ?? firstString(model.displayName) ?? model.id;
}

export function getModelProvider(model: ModelSpec): string {
  return firstString(model.providerId) ?? firstString(model.provider) ?? model.id.split('/')[0] ?? 'openrouter';
}

export function getModelProviderName(model: ModelSpec): string {
  return firstString(model.providerName) ?? getModelProvider(model);
}

export function getModelContextLength(model: ModelSpec | undefined): number | undefined {
  if (!model) return undefined;
  return typeof model.context_length === 'number'
    ? model.context_length
    : typeof model.contextLength === 'number'
      ? model.contextLength
      : typeof model.maxTokens === 'number'
        ? model.maxTokens
        : undefined;
}

export function getModelSupportedParameters(model: ModelSpec | undefined): Set<string> {
  if (!model) return new Set();
  return new Set([
    ...stringArray(model.supported_parameters),
    ...stringArray(model.supportedParameters),
  ]);
}

export function modelSupportsParameter(model: ModelSpec | undefined, parameter: string): boolean {
  return getModelSupportedParameters(model).has(parameter);
}

export function getModelInputModalities(model: ModelSpec | undefined): string[] {
  if (!model) return [];
  return [
    ...stringArray(model.architecture?.input_modalities),
    ...stringArray(model.architecture?.inputModalities),
  ];
}

export function getModelOutputModalities(model: ModelSpec | undefined): string[] {
  if (!model) return [];
  return [
    ...stringArray(model.architecture?.output_modalities),
    ...stringArray(model.architecture?.outputModalities),
  ];
}

export function getModelCapabilities(model: ModelSpec | undefined): ModelCapability[] {
  if (!model) return [];

  const supported = getModelSupportedParameters(model);
  const inputModalities = new Set(getModelInputModalities(model));
  const outputModalities = new Set(getModelOutputModalities(model));
  const capabilities: ModelCapability[] = [];

  if (supported.has('reasoning') || supported.has('reasoning_effort') || supported.has('include_reasoning')) {
    capabilities.push(ModelCapability.THINKING);
  }
  if (inputModalities.has('image')) capabilities.push(ModelCapability.VISION);
  if (outputModalities.has('image')) capabilities.push(ModelCapability.IMAGE_GENERATION);
  if (supported.has('tools')) capabilities.push(ModelCapability.TOOL_CALLING);
  if (supported.has('structured_outputs') || supported.has('response_format')) {
    capabilities.push(ModelCapability.STRUCTURED_OUTPUT);
  }

  return capabilities;
}

export function modelHasCapability(model: ModelSpec | undefined, capability: ModelCapability): boolean {
  return getModelCapabilities(model).includes(capability);
}
