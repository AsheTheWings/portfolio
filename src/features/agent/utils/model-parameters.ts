import type { ModelParameterSchema, ModelSpec } from '../types';
import { getModelSupportedParameters } from './openrouter-models';

const HIDDEN_PARAMETER_KEYS = new Set([
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'response_format',
  'web_search_options',
  'logit_bias',
  'structured_outputs',
]);

const GROUP_ORDER = ['sampling', 'penalties', 'reasoning', 'output', 'advanced'] as const;
const PARAMETER_ORDER = [
  'temperature',
  'top_p',
  'top_k',
  'top_a',
  'min_p',
  'frequency_penalty',
  'presence_penalty',
  'repetition_penalty',
  'reasoning',
  'reasoning_effort',
  'include_reasoning',
  'max_tokens',
  'max_completion_tokens',
  'stop',
  'verbosity',
  'seed',
  'logprobs',
  'top_logprobs',
];

function parameterRank(key: string): number {
  const rank = PARAMETER_ORDER.indexOf(key);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function groupRank(group: ModelParameterSchema['group']): number {
  if (!group) return Number.MAX_SAFE_INTEGER;
  const rank = GROUP_ORDER.indexOf(group as (typeof GROUP_ORDER)[number]);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

export function getModelDefaultParameters(model: ModelSpec | undefined): Record<string, unknown> {
  if (!model || model.providerId !== 'openrouter') return {};
  return model.default_parameters ?? model.defaultParameters ?? {};
}

export function getEffectiveParameterDefault(
  model: ModelSpec | undefined,
  schema: ModelParameterSchema,
): unknown {
  const modelDefaults = getModelDefaultParameters(model);
  if (Object.prototype.hasOwnProperty.call(modelDefaults, schema.key) && modelDefaults[schema.key] !== null) {
    return modelDefaults[schema.key];
  }
  return undefined;
}

export function getSupportedModelParameterSchemas(
  model: ModelSpec | undefined,
  parameterSchemas: Record<string, ModelParameterSchema>,
): ModelParameterSchema[] {
  if (!model) return [];
  const supported = getModelSupportedParameters(model);
  return Array.from(supported)
    .filter((key) => !HIDDEN_PARAMETER_KEYS.has(key))
    .map((key) => parameterSchemas[key])
    .filter((schema): schema is ModelParameterSchema => Boolean(schema))
    .sort((a, b) => {
      const groupDiff = groupRank(a.group) - groupRank(b.group);
      if (groupDiff !== 0) return groupDiff;
      const paramDiff = parameterRank(a.key) - parameterRank(b.key);
      if (paramDiff !== 0) return paramDiff;
      return a.label.localeCompare(b.label);
    });
}
