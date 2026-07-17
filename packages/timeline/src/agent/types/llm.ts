import type {
  LlmApiSurface,
  ModelParameter,
  ModelParameterApiSurface,
  ModelRegistry,
  ModelSpec,
} from '@agentime/protocol';

export type {
  LlmApiSurface,
  ModelParameterApiSurface,
  ModelSpec,
};

export type ModelParameterType = ModelParameter['type'];
export type ModelParameterDefinition = ModelParameter;
export type LlmRegistrySnapshot = ModelRegistry;
