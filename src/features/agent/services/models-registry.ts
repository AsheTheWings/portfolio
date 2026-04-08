/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Models Registry - Provider-specific model definitions and capabilities
 * Centralizes all model specifications, native tools, and provider metadata
 */

import type { 
  AgentConfig, 
  Agent, 
  NativeTool, 
  ModelSpec, 
  ModelCapability 
} from '../types';

import { ModelCapability as MC } from '../types';

// ============================================================
// Google/Gemini Provider
// ============================================================

export namespace Google {
  export const NATIVE_TOOLS = {
    GOOGLE_SEARCH: {
      id: 'googleSearch',
      name: 'Google Search',
      provider: 'google',
      description: 'Search the web with Google',
    },
    CODE_EXECUTION: {
      id: 'codeExecution',
      name: 'Code Execution',
      provider: 'google',
      description: 'Execute Python code in a sandboxed environment',
    },
    URL_CONTEXT: {
      id: 'urlContext',
      name: 'URL Context',
      provider: 'google',
      description: 'Fetch and analyze content from URLs',
    },
  } as const;

  export const MODELS: Record<string, ModelSpec> = {
    'gemini-2.5-flash': {
      id: 'gemini-2.5-flash',
      provider: 'google',
      displayName: 'Gemini 2.5 Flash',
      capabilities: [MC.THINKING, MC.VISION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
        NATIVE_TOOLS.CODE_EXECUTION,
        NATIVE_TOOLS.URL_CONTEXT,
      ],
      maxTokens: 1114291,
      supportsStreaming: true,
    },
    'gemini-2.5-flash-lite': {
      id: 'gemini-2.5-flash-lite',
      provider: 'google',
      displayName: 'Gemini 2.5 Flash Lite',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
        NATIVE_TOOLS.CODE_EXECUTION,
        NATIVE_TOOLS.URL_CONTEXT,
      ],
      maxTokens: 1114291,
      supportsStreaming: true,
    },
    'gemini-2.5-pro': {
      id: 'gemini-2.5-pro',
      provider: 'google',
      displayName: 'Gemini 2.5 Pro',
      capabilities: [MC.THINKING, MC.VISION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
        NATIVE_TOOLS.CODE_EXECUTION,
        NATIVE_TOOLS.URL_CONTEXT,
      ],
      maxTokens: 1114291,
      supportsStreaming: true,
    },
    'gemini-2.0-flash': {
      id: 'gemini-2.0-flash',
      provider: 'google',
      displayName: 'Gemini 2.0 Flash',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
        NATIVE_TOOLS.CODE_EXECUTION,
        NATIVE_TOOLS.URL_CONTEXT,
      ],
      maxTokens: 1056768,
      supportsStreaming: true,
    },
    // Gemini 3 Models (Preview)
    'gemini-3-pro-preview': {
      id: 'gemini-3-pro-preview',
      provider: 'google',
      displayName: 'Gemini 3 Pro (Preview)',
      capabilities: [MC.THINKING, MC.VISION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
        NATIVE_TOOLS.CODE_EXECUTION,
        NATIVE_TOOLS.URL_CONTEXT,
      ],
      maxTokens: 1048576,
      supportsStreaming: true,
    },
    'gemini-3-pro-image-preview': {
      id: 'gemini-3-pro-image-preview',
      provider: 'google',
      displayName: 'Gemini 3 Pro Image (Preview)',
      capabilities: [MC.THINKING, MC.VISION, MC.IMAGE_GENERATION, MC.TOOL_CALLING],
      nativeTools: [
        NATIVE_TOOLS.GOOGLE_SEARCH,
      ],
      maxTokens: 65536,
      supportsStreaming: true,
    },
    // Native Image Generation Models
    'gemini-2.5-flash-image': {
      id: 'gemini-2.5-flash-image',
      provider: 'google',
      displayName: 'Gemini 2.5 Flash Image',
      capabilities: [MC.VISION, MC.IMAGE_GENERATION],
      nativeTools: [],
      maxTokens: 32768,
      supportsStreaming: true,
    },
  };
}

// ============================================================
// OpenAI Provider (Future)
// ============================================================

export namespace OpenAI {
  export const NATIVE_TOOLS = {
    FILE_SEARCH: {
      id: 'file_search',
      name: 'File Search',
      provider: 'openai',
      description: 'Search through uploaded files and documents',
    },
    CODE_INTERPRETER: {
      id: 'code_interpreter',
      name: 'Code Interpreter',
      provider: 'openai',
      description: 'Run Python code and access files',
    },
  } as const;

  export const MODELS: Record<string, ModelSpec> = {
    'gpt-4o': {
      id: 'gpt-4o',
      provider: 'openai',
      displayName: 'GPT-4o',
      capabilities: [MC.VISION],
      nativeTools: [NATIVE_TOOLS.FILE_SEARCH, NATIVE_TOOLS.CODE_INTERPRETER],
      maxTokens: 16384,
      supportsStreaming: true,
    },
    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      provider: 'openai',
      displayName: 'GPT-4o Mini',
      capabilities: [MC.VISION],
      nativeTools: [NATIVE_TOOLS.FILE_SEARCH, NATIVE_TOOLS.CODE_INTERPRETER],
      maxTokens: 16384,
      supportsStreaming: true,
    },
  };
}

// ============================================================
// Anthropic Provider (Future)
// ============================================================

export namespace Anthropic {
  export const NATIVE_TOOLS = {} as const;

  export const MODELS: Record<string, ModelSpec> = {
    'claude-3-5-sonnet': {
      id: 'claude-3-5-sonnet',
      provider: 'anthropic',
      displayName: 'Claude 3.5 Sonnet',
      capabilities: [MC.VISION],
      nativeTools: [],
      maxTokens: 8192,
      supportsStreaming: true,
    },
  };
}

// ============================================================
// Fireworks AI Provider
// ============================================================

export namespace Fireworks {
  export const NATIVE_TOOLS = {} as const;

  export const MODELS: Record<string, ModelSpec> = {
    // -- DeepSeek --
    'accounts/fireworks/models/deepseek-r1': {
      id: 'accounts/fireworks/models/deepseek-r1',
      provider: 'fireworks',
      displayName: 'DeepSeek R1',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 163840,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/deepseek-r1-0528': {
      id: 'accounts/fireworks/models/deepseek-r1-0528',
      provider: 'fireworks',
      displayName: 'DeepSeek R1 0528',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 163840,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/deepseek-v3p1': {
      id: 'accounts/fireworks/models/deepseek-v3p1',
      provider: 'fireworks',
      displayName: 'DeepSeek V3.1',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 163840,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/deepseek-v3p2': {
      id: 'accounts/fireworks/models/deepseek-v3p2',
      provider: 'fireworks',
      displayName: 'DeepSeek V3.2',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 163840,
      supportsStreaming: true,
    },
    // -- Qwen3 --
    'accounts/fireworks/models/qwen3-235b-a22b': {
      id: 'accounts/fireworks/models/qwen3-235b-a22b',
      provider: 'fireworks',
      displayName: 'Qwen3 235B A22B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-32b': {
      id: 'accounts/fireworks/models/qwen3-32b',
      provider: 'fireworks',
      displayName: 'Qwen3 32B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-30b-a3b': {
      id: 'accounts/fireworks/models/qwen3-30b-a3b',
      provider: 'fireworks',
      displayName: 'Qwen3 30B A3B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-8b': {
      id: 'accounts/fireworks/models/qwen3-8b',
      provider: 'fireworks',
      displayName: 'Qwen3 8B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 40960,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct': {
      id: 'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct',
      provider: 'fireworks',
      displayName: 'Qwen3 Coder 480B A35B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 262144,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct': {
      id: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
      provider: 'fireworks',
      displayName: 'Qwen3 Coder 30B A3B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 262144,
      supportsStreaming: true,
    },
    // -- Qwen3 Vision --
    'accounts/fireworks/models/qwen3-vl-32b-instruct': {
      id: 'accounts/fireworks/models/qwen3-vl-32b-instruct',
      provider: 'fireworks',
      displayName: 'Qwen3 VL 32B',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/qwen3-vl-8b-instruct': {
      id: 'accounts/fireworks/models/qwen3-vl-8b-instruct',
      provider: 'fireworks',
      displayName: 'Qwen3 VL 8B',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 262144,
      supportsStreaming: true,
    },
    // -- Llama 4 --
    'accounts/fireworks/models/llama4-maverick-instruct-basic': {
      id: 'accounts/fireworks/models/llama4-maverick-instruct-basic',
      provider: 'fireworks',
      displayName: 'Llama 4 Maverick',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 1048576,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/llama4-scout-instruct-basic': {
      id: 'accounts/fireworks/models/llama4-scout-instruct-basic',
      provider: 'fireworks',
      displayName: 'Llama 4 Scout',
      capabilities: [MC.VISION, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 1048576,
      supportsStreaming: true,
    },
    // -- Kimi --
    'accounts/fireworks/models/kimi-k2-instruct': {
      id: 'accounts/fireworks/models/kimi-k2-instruct',
      provider: 'fireworks',
      displayName: 'Kimi K2 Instruct',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/kimi-k2-thinking': {
      id: 'accounts/fireworks/models/kimi-k2-thinking',
      provider: 'fireworks',
      displayName: 'Kimi K2 Thinking',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/kimi-k2p5': {
      id: 'accounts/fireworks/models/kimi-k2p5',
      provider: 'fireworks',
      displayName: 'Kimi K2.5',
      capabilities: [MC.THINKING, MC.VISION, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 262144,
      supportsStreaming: true,
    },
    // -- MiniMax --
    'accounts/fireworks/models/minimax-m2p5': {
      id: 'accounts/fireworks/models/minimax-m2p5',
      provider: 'fireworks',
      displayName: 'MiniMax M2.5',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 196608,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/minimax-m2p1': {
      id: 'accounts/fireworks/models/minimax-m2p1',
      provider: 'fireworks',
      displayName: 'MiniMax M2.1',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 196608,
      supportsStreaming: true,
    },
    // -- GLM --
    'accounts/fireworks/models/glm-4p5': {
      id: 'accounts/fireworks/models/glm-4p5',
      provider: 'fireworks',
      displayName: 'GLM 4.5',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    // -- Llama 3.3 --
    'accounts/fireworks/models/llama-v3p3-70b-instruct': {
      id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      provider: 'fireworks',
      displayName: 'Llama 3.3 70B Instruct',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    // -- Mistral --
    'accounts/fireworks/models/mistral-small-24b-instruct-2501': {
      id: 'accounts/fireworks/models/mistral-small-24b-instruct-2501',
      provider: 'fireworks',
      displayName: 'Mistral Small 24B',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 32768,
      supportsStreaming: true,
    },
    // -- OpenAI Open Source --
    'accounts/fireworks/models/gpt-oss-120b': {
      id: 'accounts/fireworks/models/gpt-oss-120b',
      provider: 'fireworks',
      displayName: 'OpenAI GPT-OSS 120B',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    'accounts/fireworks/models/gpt-oss-20b': {
      id: 'accounts/fireworks/models/gpt-oss-20b',
      provider: 'fireworks',
      displayName: 'OpenAI GPT-OSS 20B',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 131072,
      supportsStreaming: true,
    },
    // -- Seed OSS --
    'accounts/fireworks/models/seed-oss-36b-instruct': {
      id: 'accounts/fireworks/models/seed-oss-36b-instruct',
      provider: 'fireworks',
      displayName: 'Seed OSS 36B',
      capabilities: [MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 524288,
      supportsStreaming: true,
    },
    // -- NVIDIA Nemotron --
    'accounts/fireworks/models/nemotron-nano-3-30b-a3b': {
      id: 'accounts/fireworks/models/nemotron-nano-3-30b-a3b',
      provider: 'fireworks',
      displayName: 'Nemotron Nano 3 30B',
      capabilities: [MC.THINKING, MC.TOOL_CALLING],
      nativeTools: [],
      maxTokens: 262144,
      supportsStreaming: true,
    },
  };
}

// ============================================================
// Unified Registry
// ============================================================

export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  ...Google.MODELS,
  ...Fireworks.MODELS,
  // Future providers - uncomment when ready:
  // ...OpenAI.MODELS,
  // ...Anthropic.MODELS,
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get model specification by ID
 */
export function getModelSpec(modelId: string): ModelSpec | undefined {
  return MODEL_REGISTRY[modelId];
}

/**
 * Get all models for a specific provider
 */
export function getProviderModels(provider: string): ModelSpec[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): string[] {
  return Array.from(
    new Set(Object.values(MODEL_REGISTRY).map((m) => m.provider))
  );
}

/**
 * Check if a model supports a specific capability
 */
export function hasCapability(
  modelId: string,
  capability: ModelCapability
): boolean {
  const spec = getModelSpec(modelId);
  return spec?.capabilities.includes(capability) ?? false;
}

/**
 * Get native tools for a model
 */
export function getModelNativeTools(modelId: string): NativeTool[] {
  const spec = getModelSpec(modelId);
  return spec?.nativeTools ?? [];
}

/**
 * Create default agent config based on model spec
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
 * Used when no saved agent is selected.
 */
export function createAssistantAgent(modelId?: string): Agent {
  return {
    agentId: 'none',
    config: createDefaultAgentConfig(modelId),
  };
}

/**
 * Validate if a model ID is registered
 */
export function isValidModel(modelId: string): boolean {
  return modelId in MODEL_REGISTRY;
}

/**
 * Get default model for a provider
 */
export function getDefaultModelForProvider(provider: string): string | null {
  const models = getProviderModels(provider);
  if (models.length === 0) return null;
  
  // Return first model as default
  return models[0].id;
}
