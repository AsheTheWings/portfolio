/**
 * Fireworks AI Provider Service
 * Uses OpenAI-compatible API with streaming, tool calling, reasoning, and vision support
 */

import { AssetService } from '@/features/library/services/asset.service';
import { ModelCapability } from '../types';
import type {
  SessionEvent,
  AgentConfig,
  AgentMetadata,
  UsageMetrics,
  ModelSpec,
} from '../types';
import { createDefaultAgentConfig, MODEL_REGISTRY } from './models-registry';

// ============================================================
// API Key Management
// ============================================================

function loadApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`FIREWORKS_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  // Fallback to single key
  if (keys.length === 0) {
    const key = process.env.FIREWORKS_API_KEY;
    if (key) keys.push(key);
  }
  if (keys.length === 0) {
    throw new Error('No Fireworks API key found. Set FIREWORKS_API_KEY or FIREWORKS_API_KEY_1, etc.');
  }
  return keys;
}

// ============================================================
// Types
// ============================================================

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';

interface FireworksMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | FireworksContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  reasoning_content?: string | null;
}

type FireworksContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface FireworksStreamDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface FireworksStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: FireworksStreamDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  };
}

interface AccumulatedState {
  text: string;
  reasoning: string;
  toolCalls: Map<number, {
    id: string;
    name: string;
    arguments: string;
  }>;
  reasoningFinalized: boolean;
  usage?: FireworksStreamChunk['usage'];
}

interface ModelCallContext {
  config: AgentConfig;
  toolNameMap: Map<string, { server: string; tool: string }>;
}

// ============================================================
// Vision Asset Resolution
// ============================================================

/** Fireworks limits conversations to 30 images. Use 25 to leave headroom. */
const MAX_FIREWORKS_IMAGES = 25;

/**
 * Resolve library asset IDs from session events to image URLs.
 * Returns a map of eventId → array of { mimeType, url } for vision-capable models.
 * Uses Supabase signed URLs directly (7-day TTL) to avoid base64 payload bloat.
 *
 * Prioritizes the most recent events when the conversation exceeds the
 * Fireworks image-per-conversation limit (30). Older events simply won't
 * have their images resolved — they'll fall through to the text-only path
 * in buildFireworksMessages.
 */
async function resolveLibraryAssets(
  events: SessionEvent[]
): Promise<Map<string, Array<{ mimeType: string; url: string }>>> {
  const result = new Map<string, Array<{ mimeType: string; url: string }>>();

  // Collect eventId → libraryItemIds, preserving chronological order
  const eventAssetEntries: Array<{ eventId: string; ids: string[] }> = [];
  for (const event of events) {
    if (
      event.type === 'user-turn-completed' &&
      event.data.libraryItemIds &&
      event.data.libraryItemIds.length > 0
    ) {
      eventAssetEntries.push({ eventId: event.eventId, ids: event.data.libraryItemIds });
    }
    if (
      event.type === 'tool-result' &&
      (event.data.result as { libraryItemIds?: string[] })?.libraryItemIds?.length
    ) {
      eventAssetEntries.push({
        eventId: event.eventId,
        ids: (event.data.result as { libraryItemIds: string[] }).libraryItemIds,
      });
    }
  }

  if (eventAssetEntries.length === 0) return result;

  // Walk events newest-first, collecting up to MAX_FIREWORKS_IMAGES asset IDs
  const selectedIds = new Set<string>();
  const selectedEvents: Array<{ eventId: string; ids: string[] }> = [];
  for (let i = eventAssetEntries.length - 1; i >= 0; i--) {
    const entry = eventAssetEntries[i];
    const remaining = MAX_FIREWORKS_IMAGES - selectedIds.size;
    if (remaining <= 0) break;
    const idsToUse = entry.ids.slice(0, remaining);
    idsToUse.forEach(id => selectedIds.add(id));
    selectedEvents.push({ eventId: entry.eventId, ids: idsToUse });
  }

  if (selectedIds.size === 0) return result;

  // Fetch asset metadata (includes signed URLs)
  const assets = await AssetService.getAssetsByIds(Array.from(selectedIds)).catch(err => {
    console.error('Failed to fetch assets for Fireworks vision:', err);
    return [] as Array<{ id: string; url: string; mime_type: string; file_name: string }>;
  });

  if (assets.length === 0) return result;

  // Filter to image assets only, build lookup map
  const resolvedMap = new Map<string, { mimeType: string; url: string }>();
  for (const asset of assets) {
    if (asset.mime_type.startsWith('image/') && asset.url) {
      resolvedMap.set(asset.id, { mimeType: asset.mime_type, url: asset.url });
    }
  }

  if (resolvedMap.size === 0) return result;

  // Map back to events
  for (const { eventId, ids } of selectedEvents) {
    const parts: Array<{ mimeType: string; url: string }> = [];
    for (const id of ids) {
      const resolved = resolvedMap.get(id);
      if (resolved) parts.push(resolved);
    }
    if (parts.length > 0) result.set(eventId, parts);
  }

  return result;
}

// ============================================================
// Session Event → OpenAI Messages Conversion
// ============================================================

function buildFireworksMessages(
  events: SessionEvent[],
  config: AgentConfig,
  toolNameMap: Map<string, { server: string; tool: string }>,
  resolvedAssets: Map<string, Array<{ mimeType: string; url: string }>> = new Map(),
  eventPaths: Map<string, string[]> = new Map(),
): FireworksMessage[] {
  const messages: FireworksMessage[] = [];
  const modelSpec = getModelSpec(config.model);
  const supportsThinking = modelSpec.capabilities.includes('thinking' as never);
  const includeReasoning = supportsThinking && config.includeThoughtsInContext !== false;

  // Forward-buffer: reasoning arrives BEFORE the assistant message it belongs to
  let pendingReasoning: string | null = null;

  // System instruction
  if (config.systemInstructions) {
    messages.push({ role: 'system', content: config.systemInstructions });
  }

  for (const event of events) {
    switch (event.type) {
      case 'user-turn-completed': {
        const text = event.data.message || '';
        const assetParts = resolvedAssets.get(event.eventId);
        const paths = eventPaths.get(event.eventId);

        if (assetParts && assetParts.length > 0) {
          const contentParts: FireworksContentPart[] = [];
          if (text) contentParts.push({ type: 'text', text });
          for (const asset of assetParts) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: asset.url },
            });
          }
          // Annotate with library paths and clarify the images are already visible
          if (paths && paths.length > 0) {
            contentParts.push({ type: 'text', text: `[Attached files: ${paths.join(', ')}]\n[Note: These images are already loaded in your visual context.]` });
          }
          messages.push({ role: 'user', content: contentParts });
        } else if (text) {
          // Even without vision assets, annotate paths if library items were attached (non-image assets)
          const finalText = paths?.length
            ? `${text}\n[Attached files: ${paths.join(', ')}]`
            : text;
          messages.push({ role: 'user', content: finalText });
        }
        break;
      }

      case 'model-thought-completed': {
        // Buffer reasoning — attaches to the NEXT assistant message or tool-call
        if (includeReasoning) {
          pendingReasoning = event.data.thoughts;
        }
        break;
      }

      case 'model-message-completed': {
        const msg: FireworksMessage = {
          role: 'assistant',
          content: event.data.message || '',
        };
        if (pendingReasoning) {
          msg.reasoning_content = pendingReasoning;
          pendingReasoning = null;
        }
        messages.push(msg);
        break;
      }

      case 'tool-call': {
        const formattedName = formatToolName(event.data.server, event.data.tool);
        toolNameMap.set(formattedName, { server: event.data.server, tool: event.data.tool });
        
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.tool_calls) {
          // Append to existing tool-call batch
          lastMsg.tool_calls.push({
            id: event.eventId,
            type: 'function',
            function: {
              name: formattedName,
              arguments: JSON.stringify(event.data.arguments || {}),
            },
          });
        } else {
          // New assistant message for tool calls — attach pending reasoning
          const msg: FireworksMessage = {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: event.eventId,
              type: 'function',
              function: {
                name: formattedName,
                arguments: JSON.stringify(event.data.arguments || {}),
              },
            }],
          };
          if (pendingReasoning) {
            msg.reasoning_content = pendingReasoning;
            pendingReasoning = null;
          }
          messages.push(msg);
        }
        break;
      }

      case 'tool-result': {
        const resultStr = typeof event.data.result === 'string'
          ? event.data.result
          : JSON.stringify(event.data.result);
        
        let toolCallId = event.componentId;
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === 'assistant' && msg.tool_calls) {
            const formattedName = formatToolName(event.data.server, event.data.tool);
            const match = msg.tool_calls.find(tc => tc.function.name === formattedName);
            if (match) {
              toolCallId = match.id;
              break;
            }
          }
        }
        
        messages.push({
          role: 'tool',
          content: resultStr,
          tool_call_id: toolCallId,
        });

        // Inject synthetic vision message for tool results with library assets
        const toolAssetParts = resolvedAssets.get(event.eventId);
        if (toolAssetParts && toolAssetParts.length > 0) {
          const contentParts: FireworksContentPart[] = [
            {
              type: 'text',
              text: '[SYSTEM] Tool output visualization — the image(s) below were produced by the tool you just invoked. This is not a user message.',
            },
            ...toolAssetParts.map(asset => ({
              type: 'image_url' as const,
              image_url: { url: asset.url },
            })),
          ];
          messages.push({ role: 'user', content: contentParts });
        }
        break;
      }
    }
  }

  return messages;
}

// ============================================================
// Tool Formatting
// ============================================================

function buildToolDefinitions(
  config: AgentConfig,
  toolNameMap: Map<string, { server: string; tool: string }>
): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> | undefined {
  if (!config.enableTools || config.availableTools.length === 0) return undefined;

  return config.availableTools.map(tool => {
    const formattedName = formatToolName(tool.server, tool.tool);
    toolNameMap.set(formattedName, { server: tool.server, tool: tool.tool });
    return {
      type: 'function' as const,
      function: {
        name: formattedName,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    };
  });
}

function formatToolName(server: string, tool: string): string {
  const normTool = tool.replace(/-/g, '_');
  const normServer = server.replace(/-/g, '_');
  if (normTool.startsWith(normServer + '_')) return normTool;
  return `${normServer}_${normTool}`;
}

// ============================================================
// Streaming Execution
// ============================================================

async function* executeStreamingCall(
  apiKey: string,
  messages: FireworksMessage[],
  ctx: ModelCallContext,
  state: AccumulatedState
): AsyncGenerator<SessionEvent> {
  const modelSpec = getModelSpec(ctx.config.model);
  const tools = buildToolDefinitions(ctx.config, ctx.toolNameMap);
  const supportsThinking = modelSpec.capabilities.includes('thinking' as never);

  // Build request body
  const body: Record<string, unknown> = {
    model: ctx.config.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: ctx.config.temperature,
    top_p: ctx.config.topP,
  };

  if (ctx.config.maxOutputTokens) {
    body.max_tokens = ctx.config.maxOutputTokens;
  }

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  // Reasoning/thinking support
  if (ctx.config.enableThinking && supportsThinking) {
    const budget = ctx.config.thinkingBudget && ctx.config.thinkingBudget > 0
      ? ctx.config.thinkingBudget
      : 8192; // default thinking budget when not explicitly configured
    body.thinking = {
      type: 'enabled',
      budget_tokens: budget,
    };

    // Control how reasoning context is preserved across turns
    body.reasoning_history = ctx.config.includeThoughtsInContext !== false
      ? 'preserved'
      : 'disabled';
  }

  // Structured output
  if (ctx.config.responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: ctx.config.responseSchema,
      },
    };
  }

  const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Fireworks API error ${response.status}: ${errorBody}`);
  }

  if (!response.body) {
    throw new Error('No response body from Fireworks API');
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      let chunk: FireworksStreamChunk;
      try {
        chunk = JSON.parse(trimmed.slice(6));
      } catch {
        continue;
      }

      // Capture usage from the final chunk
      if (chunk.usage) {
        state.usage = chunk.usage;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;

      // Handle reasoning content (thinking)
      if (delta.reasoning_content) {
        state.reasoning += delta.reasoning_content;
        yield {
          type: 'model-thought-chunk',
          eventId: crypto.randomUUID(),
          componentId: crypto.randomUUID(),
          turnId: crypto.randomUUID(),
          role: 'agent',
          sequence: 0,
          timestamp: new Date(),
          data: { thoughts: delta.reasoning_content, metadata: {} },
        } as SessionEvent;
      }

      // Handle content text
      if (delta.content) {
        // Finalize thoughts before first content chunk
        if (!state.reasoningFinalized && state.reasoning) {
          yield* finalizeReasoning(state);
        }

        state.text += delta.content;
        yield {
          type: 'model-message-chunk',
          eventId: crypto.randomUUID(),
          componentId: crypto.randomUUID(),
          turnId: crypto.randomUUID(),
          role: 'agent',
          sequence: 0,
          timestamp: new Date(),
          data: { message: delta.content, metadata: {} },
        } as SessionEvent;
      }

      // Handle tool calls (streamed incrementally)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = state.toolCalls.get(tc.index);
          if (existing) {
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
          } else {
            state.toolCalls.set(tc.index, {
              id: tc.id || crypto.randomUUID(),
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '',
            });
          }
        }
      }
    }
  }

  // Finalize
  yield* finalizeResponse(ctx, state);
}

// ============================================================
// Finalization
// ============================================================

function* finalizeReasoning(state: AccumulatedState): Generator<SessionEvent> {
  yield {
    type: 'model-thought-completed',
    eventId: crypto.randomUUID(),
    componentId: crypto.randomUUID(),
    turnId: crypto.randomUUID(),
    role: 'agent',
    sequence: 0,
    timestamp: new Date(),
    data: { thoughts: state.reasoning, metadata: {} },
  } as SessionEvent;
  state.reasoningFinalized = true;
}

function* finalizeResponse(ctx: ModelCallContext, state: AccumulatedState): Generator<SessionEvent> {
  // Finalize thoughts if pending
  if (!state.reasoningFinalized && state.reasoning) {
    yield* finalizeReasoning(state);
  }

  const modelSpec = getModelSpec(ctx.config.model);
  const metadata = buildMetadata(state, modelSpec);

  // Yield message completed
  if (state.text) {
    yield {
      type: 'model-message-completed',
      eventId: crypto.randomUUID(),
      componentId: crypto.randomUUID(),
      turnId: crypto.randomUUID(),
      role: 'agent',
      sequence: 0,
      timestamp: new Date(),
      data: { message: state.text, metadata },
    } as SessionEvent;
  }

  // Yield tool calls
  if (state.toolCalls.size > 0) {
    const seen = new Set<string>();
    for (const [, tc] of state.toolCalls) {
      // Deduplicate by name+args
      const dedupeKey = `${tc.name}:${tc.arguments}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Resolve original server/tool names
      const original = ctx.toolNameMap.get(tc.name);
      if (!original) {
        console.warn(`⚠️ Unknown tool call: ${tc.name}`);
        continue;
      }

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.arguments);
      } catch {
        console.warn(`⚠️ Failed to parse tool arguments for ${tc.name}`);
      }

      yield {
        type: 'tool-call',
        eventId: crypto.randomUUID(),
        componentId: crypto.randomUUID(),
        turnId: crypto.randomUUID(),
        role: 'agent',
        sequence: 0,
        timestamp: new Date(),
        data: {
          server: original.server,
          tool: original.tool,
          arguments: parsedArgs,
          metadata,
        },
      } as SessionEvent;
    }
  }
}

// ============================================================
// Metadata
// ============================================================

function buildMetadata(state: AccumulatedState, modelSpec: ModelSpec): AgentMetadata {
  return {
    usage: normalizeUsage(state.usage, modelSpec.maxTokens),
  };
}

function normalizeUsage(
  usage: FireworksStreamChunk['usage'] | undefined,
  maxTokens?: number
): UsageMetrics | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    thinkingTokens: usage.reasoning_tokens,
    maxTokens,
  };
}

// ============================================================
// Error Handling
// ============================================================

function handleError(e: unknown, attempt: number, maxAttempts: number, keyIndex: number): boolean {
  const errorMessage = e instanceof Error ? e.message : String(e);
  const errorStr = errorMessage.toLowerCase();

  const isTransient = ['429', '503', 'quota', 'rate limit', 'overloaded'].some(s => errorStr.includes(s));
  const isAuthError = ['401', 'unauthorized', 'invalid api key', 'authentication'].some(s => errorStr.includes(s));
  const shouldRotate = isTransient || isAuthError;

  console.error(`❌ Fireworks key #${keyIndex + 1} error:`, errorMessage);

  if (shouldRotate && attempt < maxAttempts - 1) {
    console.log(`🔄 Rotating to next Fireworks key...`);
    return true;
  }
  return false;
}

// ============================================================
// Model Spec Resolution
// ============================================================

function getModelSpec(modelId: string): ModelSpec {
  if (modelId in MODEL_REGISTRY) {
    return MODEL_REGISTRY[modelId];
  }
  console.warn(`⚠️ Unknown Fireworks model: ${modelId}`);
  return {
    id: modelId,
    provider: 'fireworks',
    displayName: modelId.split('/').pop() || modelId,
    capabilities: [],
    maxTokens: 131072,
    supportsStreaming: true,
  };
}

// ============================================================
// Main Export
// ============================================================

/**
 * Call Fireworks AI model with session events
 * Converts events to OpenAI message format and streams response
 * Resolves library assets to base64 for vision-capable models
 */
export async function* callFireworks(
  sessionEvents: SessionEvent[],
  agentConfig: AgentConfig
): AsyncGenerator<SessionEvent> {
  if (!sessionEvents?.length) throw new Error('sessionEvents cannot be empty');
  if (!agentConfig) throw new Error('agentConfig is required');

  const config: AgentConfig = { ...createDefaultAgentConfig(agentConfig.model), ...agentConfig };
  const toolNameMap = new Map<string, { server: string; tool: string }>();
  const ctx: ModelCallContext = { config, toolNameMap };

  // Resolve library assets for vision-capable models
  const modelSpec = getModelSpec(config.model);
  const hasVision = modelSpec.capabilities.includes(ModelCapability.VISION);
  const resolvedAssets = hasVision
    ? await resolveLibraryAssets(sessionEvents)
    : new Map<string, Array<{ mimeType: string; url: string }>>();

  // Resolve library paths for user-attached assets (so the model knows their paths)
  const allUserAssetIds = new Set<string>();
  for (const event of sessionEvents) {
    if (event.type === 'user-turn-completed' && event.data.libraryItemIds?.length) {
      event.data.libraryItemIds.forEach((id: string) => allUserAssetIds.add(id));
    }
  }
  const assetPaths = allUserAssetIds.size > 0
    ? await AssetService.getAssetPaths(Array.from(allUserAssetIds))
    : [];
  const assetPathMap = new Map(assetPaths.map(a => [a.id, a.path]));

  const eventPathsMap = new Map<string, string[]>();
  for (const event of sessionEvents) {
    if (event.type === 'user-turn-completed' && event.data.libraryItemIds?.length) {
      const paths = event.data.libraryItemIds
        .map((id: string) => assetPathMap.get(id))
        .filter((p): p is string => !!p);
      if (paths.length > 0) eventPathsMap.set(event.eventId, paths);
    }
  }

  // Build messages from session events (with resolved vision assets)
  const messages = buildFireworksMessages(sessionEvents, config, toolNameMap, resolvedAssets, eventPathsMap);
  if (messages.length === 0) {
    throw new Error('No valid messages to send to Fireworks model');
  }

  // Initialize state
  const state: AccumulatedState = {
    text: '',
    reasoning: '',
    toolCalls: new Map(),
    reasoningFinalized: false,
  };

  const apiKeys = loadApiKeys();
  const maxAttempts = apiKeys.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = attempt % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

    try {
      yield* executeStreamingCall(apiKey, messages, ctx, state);
      console.log(`✅ Fireworks key #${keyIndex + 1} succeeded`);
      break;
    } catch (e: unknown) {
      if (!handleError(e, attempt, maxAttempts, keyIndex)) {
        throw e;
      }
    }
  }

  if (state.text === '' && state.toolCalls.size === 0 && !state.reasoningFinalized) {
    throw new Error('All Fireworks API keys exhausted - model call failed after all retry attempts');
  }
}
