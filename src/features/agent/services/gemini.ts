/**
 * Gemini Provider Service
 * Handles Gemini-specific model calling with session event reconstruction
 */

import { GoogleGenAI } from '@google/genai';
import { AssetService } from '@/features/library/services/asset.service';
import { FolderService } from '@/features/library/services/folder.service';
import { ModelCapability } from '../types';
import type {
  SessionEvent,
  AgentConfig,
  AgentMetadata,
  NativeToolMetadata,
  UsageMetrics,
} from '../types';
import { createDefaultAgentConfig, MODEL_REGISTRY } from './models-registry';
import type { ModelSpec } from '../types';

// ============================================================
// API Key Management
// ============================================================

// NANO_BANANA key is reserved exclusively for image generation models
const IMAGE_MODEL_KEY_NAME = 'NANO_BANANA';

function loadApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY_N found. Use GEMINI_API_KEY_1, etc.');
  }
  return keys;
}

function loadImageModelKey(): string {
  const key = process.env[IMAGE_MODEL_KEY_NAME];
  if (!key) {
    throw new Error(`${IMAGE_MODEL_KEY_NAME} API key not found for image generation models`);
  }
  return key;
}

// ============================================================
// Types & Interfaces
// ============================================================

interface ModelCallContext {
  config: AgentConfig;
  toolNameMap: Map<string, { server: string; tool: string }>;
  userId?: string;  // For image generation asset creation
}

interface AccumulatedState {
  text: string;
  thoughts: string;
  toolCalls: Array<{ functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }>;
  codeExecutionParts: Array<{ executableCode?: { code: string }; codeExecutionResult?: { output: string; outcome: string } }>;
  inlineImages: Array<{ mimeType: string; data: string }>;
  thoughtsFinalized: boolean;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
  groundingMetadata?: { groundingChunks?: unknown[]; groundingSupports?: unknown[]; webSearchQueries?: string[] };
  urlContextMetadata?: { urlMetadata?: Array<{ retrieved_url?: string; retrievedUrl?: string; url_retrieval_status?: string; urlRetrievalStatus?: string }> };
}

// ============================================================
// Gemini Files API - Asset Resolution
// ============================================================


/**
 * Resolve all library item IDs from multiple events to Gemini file parts in parallel
 * Returns a map of eventId -> resolved parts
 */
async function resolveAllLibraryItemParts(
  eventAssetMap: Map<string, string[]>,
  client: GoogleGenAI
): Promise<Map<string, Array<{ fileData: { fileUri: string; mimeType: string } }>>> {
  const result = new Map<string, Array<{ fileData: { fileUri: string; mimeType: string } }>>();
  
  // Collect all unique library item IDs across all events
  const allLibraryItemIds = new Set<string>();
  for (const libraryItemIds of eventAssetMap.values()) {
    libraryItemIds.forEach(id => allLibraryItemIds.add(id));
  }
  
  if (allLibraryItemIds.size === 0) return result;
  
  // 1. Batch fetch all asset metadata in parallel with Gemini file listing
  const [assets, existingFiles] = await Promise.all([
    // Fetch asset metadata
    AssetService.getAssetsByIds(Array.from(allLibraryItemIds)).catch(err => {
      console.error('Failed to fetch assets:', err);
      return [] as Array<{ id: string; url: string; mimeType: string; fileName: string }>;
    }),
    // List existing Gemini files for cache check
    listGeminiFiles(client),
  ]);
  
  if (!assets || assets.length === 0) return result;
  
  // 2. Determine which assets need uploading vs cached
  const assetsToUpload: Array<{ id: string; url: string; mimeType: string; fileName: string }> = [];
  const resolvedParts = new Map<string, { fileData: { fileUri: string; mimeType: string } }>();
  
  for (const asset of assets) {
    const cachedFile = existingFiles.get(asset.id);
    
    if (cachedFile) {
      console.log(`📁 Using cached Gemini file: ${asset.fileName} (${asset.id})`);
      resolvedParts.set(asset.id, {
        fileData: {
          fileUri: cachedFile.uri,
          mimeType: asset.mimeType,
        },
      });
      continue;
    }
    
    assetsToUpload.push(asset);
  }
  
  if (resolvedParts.size > 0) {
    console.log(`📁 Total cached files: ${resolvedParts.size}`);
  }
  
  // 3. Parallel fetch from storage + upload to Gemini for non-cached assets
  if (assetsToUpload.length > 0) {
    console.log(`⬆️ Uploading ${assetsToUpload.length} file(s) to Gemini storage...`);
    
    const uploadResults = await Promise.allSettled(
      assetsToUpload.map(async (asset) => {
        console.log(`⬆️ Uploading: ${asset.fileName} (${asset.id})`);
        
        // Fetch from our storage
        const fileResponse = await fetch(asset.url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch: ${fileResponse.statusText}`);
        }
        
        const blob = await fileResponse.blob();
        
        // Upload to Gemini
        const uploadedFile = await client.files.upload({
          file: blob,
          config: {
            displayName: asset.id,
            mimeType: asset.mimeType,
          },
        });
        
        console.log(`✅ Uploaded: ${asset.fileName}`);
        return { assetId: asset.id, uri: uploadedFile.uri, mimeType: asset.mimeType };
      })
    );
    
    // Collect successful uploads
    for (const result of uploadResults) {
      if (result.status === 'fulfilled' && result.value.uri) {
        resolvedParts.set(result.value.assetId, {
          fileData: {
            fileUri: result.value.uri,
            mimeType: result.value.mimeType,
          },
        });
      } else if (result.status === 'rejected') {
        console.error('Asset upload failed:', result.reason);
      }
    }
  }
  
  // 4. Map resolved parts back to events
  for (const [eventId, libraryItemIds] of eventAssetMap) {
    const parts: Array<{ fileData: { fileUri: string; mimeType: string } }> = [];
    for (const assetId of libraryItemIds) {
      const part = resolvedParts.get(assetId);
      if (part) parts.push(part);
    }
    if (parts.length > 0) {
      result.set(eventId, parts);
    }
  }
  
  return result;
}

/**
 * List existing Gemini files for cache lookup
 */
async function listGeminiFiles(
  client: GoogleGenAI
): Promise<Map<string, { name: string; uri: string; expirationTime: string }>> {
  const existingFiles = new Map<string, { name: string; uri: string; expirationTime: string }>();
  
  try {
    const filesResponse = await client.files.list({ config: { pageSize: 100 } });
    for await (const file of filesResponse) {
      if (file.displayName && file.state === 'ACTIVE') {
        existingFiles.set(file.displayName, {
          name: file.name!,
          uri: file.uri!,
          expirationTime: file.expirationTime!,
        });
      }
    }
  } catch (err) {
    console.warn('Failed to list Gemini files:', err);
  }
  
  return existingFiles;
}

// ============================================================
// API Contents Builder (Gemini-Specific Format)
// ============================================================

/**
 * Build Gemini API contents from session events
 * Reconstructs the conversation history in Gemini's format
 * Note: Asset resolution is handled separately in callGemini
 * 
 * @param includeThoughts - Whether to include model-thought-completed events as {thought: true} parts
 * @param modelSupportsThinking - Whether the target model supports thinking at all
 */
function buildGeminiApiContents(
  events: SessionEvent[],
  resolvedAssetParts: Map<string, Array<{ fileData: { fileUri: string; mimeType: string } }>> = new Map(),
  includeThoughts: boolean = true,
  modelSupportsThinking: boolean = true,
  eventPaths: Map<string, string[]> = new Map(),
): Array<{ role: string; parts: unknown[] } | null> {
  return events
    .filter(event => {
      return (
        event.type === 'user-turn-completed' ||
        event.type === 'model-message-completed' ||
        event.type === 'tool-call' ||
        event.type === 'tool-result' ||
        (event.type === 'model-thought-completed' && includeThoughts && modelSupportsThinking)
      );
    })
    .map(event => {
      if (event.type === 'user-turn-completed') {
        const parts: Array<{ text?: string; fileData?: { fileUri: string; mimeType: string } }> = [];
        
        if (event.data.message) {
          parts.push({ text: event.data.message });
        }
        
        // Add resolved asset parts for this event
        const assetParts = resolvedAssetParts.get(event.eventId);
        if (assetParts && assetParts.length > 0) {
          parts.push(...assetParts);

          // Annotate with library paths and clarify the images are already visible
          const paths = eventPaths.get(event.eventId);
          if (paths && paths.length > 0) {
            parts.push({ text: `[Attached files: ${paths.join(', ')}]\n[Note: These images are already loaded in your visual context above. Analyze them directly — no need to use read_assets unless you need metadata.]` });
          }
        }
        
        return { role: 'user', parts };
      }
      
      if (event.type === 'model-message-completed') {
        return {
          role: 'model',
          parts: [{ text: event.data.message }],
        };
      }
      
      if (event.type === 'model-thought-completed') {
        return {
          role: 'model',
          parts: [{ text: event.data.thoughts, thought: true }],
        };
      }
      
      if (event.type === 'tool-call') { 
        const formattedName = formatToolName(event.data.server, event.data.tool);
        const part: { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string } = {
          functionCall: {
            name: formattedName,
            args: event.data.arguments || {},
          },
        };
        // Include thoughtSignature for thinking-capable models (required for Gemini 3+ function calling)
        if (event.data.thoughtSignature && modelSupportsThinking) {
          part.thoughtSignature = event.data.thoughtSignature;
        }
        return {
          role: 'model',
          parts: [part],
        };
      }
      
      if (event.type === 'tool-result') {
        const formattedName = formatToolName(event.data.server, event.data.tool);
        // Result is always an object (errors have { status: 'error', message: '...' })
        const response = typeof event.data.result === 'object' && event.data.result !== null && !Array.isArray(event.data.result)
          ? event.data.result as Record<string, unknown>
          : { result: event.data.result };
        
        const parts: Array<{ functionResponse: { name: string; response: Record<string, unknown> } } | { fileData: { fileUri: string; mimeType: string } }> = [{
          functionResponse: {
            name: formattedName,
            response,
          },
        }];
        
        // Add resolved asset parts for this tool result (file URIs alongside function response)
        const assetParts = resolvedAssetParts.get(event.eventId);
        if (assetParts && assetParts.length > 0) {
          parts.push(...assetParts);
        }
        
        return { role: 'tool', parts };
      }
      
      return null;
    })
    .filter(Boolean) as Array<{ role: string; parts: unknown[] } | null>;
}

// ============================================================
// Main Export
// ============================================================

/**
 * Call Gemini model with session events
 * Builds API contents internally from events
 * Resolves asset IDs to Gemini file URIs before calling the model
 */
export async function* callGemini(
  sessionEvents: SessionEvent[],
  agentConfig: AgentConfig,
  userId?: string
): AsyncGenerator<SessionEvent> {
  // Validation
  if (!sessionEvents?.length) throw new Error('sessionEvents cannot be empty');
  if (!agentConfig) throw new Error('agentConfig is required');

  // Setup configuration
  const config: AgentConfig = { ...createDefaultAgentConfig(), ...agentConfig };
  const toolNameMap = new Map<string, { server: string; tool: string }>();
  
  // Initialize context
  const context: ModelCallContext = {
    config,
    toolNameMap,
    userId,
  };

  // Determine if this is an image generation model
  const modelSpec = getModelSpec(config.model);
  const isImageModel = modelSpec?.capabilities.includes(ModelCapability.IMAGE_GENERATION) ?? false;
  
  // API Key Selection: image models use NANO_BANANA exclusively
  const apiKeys = isImageModel ? [loadImageModelKey()] : loadApiKeys();
  const firstApiKey = apiKeys[0];
  const client = new GoogleGenAI({ apiKey: firstApiKey });
  
  if (isImageModel) {
    console.log(`🖼️ Using ${IMAGE_MODEL_KEY_NAME} key for image model: ${config.model}`);
  }
  
  // Resolve asset IDs to Gemini file parts for user turns and tool results (parallel)
  const eventAssetMap = new Map<string, string[]>();
  for (const event of sessionEvents) {
    // User turn library items (attached via asset picker)
    if (
      event.type === 'user-turn-completed' &&
      event.data.libraryItemIds &&
      event.data.libraryItemIds.length > 0
    ) {
      eventAssetMap.set(event.eventId, event.data.libraryItemIds);
    }
    // Tool result assets (from library:browse read actions)
    if (
      event.type === 'tool-result' &&
      (event.data.result as { libraryItemIds?: string[] })?.libraryItemIds &&
      (event.data.result as { libraryItemIds?: string[] }).libraryItemIds!.length > 0
    ) {
      eventAssetMap.set(event.eventId, (event.data.result as { libraryItemIds: string[] }).libraryItemIds);
    }
  }
  
  const resolvedAssetParts = await resolveAllLibraryItemParts(eventAssetMap, client);

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

  // Build eventId → paths[] for user turns
  const eventPathsMap = new Map<string, string[]>();
  for (const event of sessionEvents) {
    if (event.type === 'user-turn-completed' && event.data.libraryItemIds?.length) {
      const paths = event.data.libraryItemIds
        .map((id: string) => assetPathMap.get(id))
        .filter((p): p is string => !!p);
      if (paths.length > 0) eventPathsMap.set(event.eventId, paths);
    }
  }

  // Build API Contents from session events with resolved assets
  const supportsThinking = modelSpec?.capabilities.includes(ModelCapability.THINKING) ?? false;
  const includeThoughtsInCtx = config.includeThoughtsInContext !== false;
  const apiContents = buildGeminiApiContents(sessionEvents, resolvedAssetParts, includeThoughtsInCtx, supportsThinking, eventPathsMap).filter((c): c is { role: string; parts: unknown[] } => c !== null);
  if (apiContents.length === 0) {
    throw new Error('No valid content to send to model');
  }

  // Initialize state
  const state: AccumulatedState = {
    text: '',
    thoughts: '',
    toolCalls: [],
    codeExecutionParts: [],
    inlineImages: [],
    thoughtsFinalized: false,
  };

  const maxAttempts = apiKeys.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = attempt % apiKeys.length;
    const apiKey = apiKeys[keyIndex];
    
    try {
      if (attempt >= apiKeys.length) {
        console.log(`🔄 Retrying key #1 (attempt ${attempt + 1}/${maxAttempts})`);
      }

      yield* executeModelCall(apiKey, apiContents, context, state);
      
      console.log(`✅ Key #${keyIndex + 1} succeeded`);
      break;

    } catch (e: unknown) {
      if (!handleError(e, attempt, maxAttempts, keyIndex, apiKey)) {
        throw e;
      }
    }
  }
  
  // Check if all attempts failed (loop exhausted without success)
  if (state.text === '' && state.toolCalls.length === 0 && !state.thoughtsFinalized) {
    throw new Error('All API keys exhausted - model call failed after all retry attempts');
  }
}

// ============================================================
// Execution Logic
// ============================================================

async function* executeModelCall(
  apiKey: string,
  contents: unknown[],
  ctx: ModelCallContext,
  state: AccumulatedState
): AsyncGenerator<SessionEvent> {
  const client = new GoogleGenAI({ apiKey });
  const modelSpec = getModelSpec(ctx.config.model);
  const generationConfig = buildGenerationConfig(modelSpec, ctx.config, ctx.toolNameMap);

  const response = await client.models.generateContentStream({
    model: ctx.config.model,
    contents: contents as Parameters<typeof client.models.generateContentStream>[0]['contents'],
    config: generationConfig,
  });

  for await (const chunk of response) {
    // Collect Metadata
    if (chunk.usageMetadata) state.usageMetadata = chunk.usageMetadata;
    if (chunk.candidates?.[0]) {
      const candidate = chunk.candidates[0];
      if (candidate.groundingMetadata) state.groundingMetadata = candidate.groundingMetadata;
      if ((candidate as { urlContextMetadata?: unknown }).urlContextMetadata) {
        state.urlContextMetadata = (candidate as { urlContextMetadata?: { urlMetadata?: Array<{ retrieved_url?: string; retrievedUrl?: string; url_retrieval_status?: string; urlRetrievalStatus?: string }> } }).urlContextMetadata;
      }
      
      // Process Content Parts
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          yield* processContentPart(part, ctx, state);
        }
      }
    }
  }

  // Finalize Response
  yield* finalizeResponse(ctx, state);
}

async function* processContentPart(
  part: unknown,
  ctx: ModelCallContext,
  state: AccumulatedState
): AsyncGenerator<SessionEvent> {
  // Handle Code Execution
  if ((part as { executableCode?: unknown; codeExecutionResult?: unknown }).executableCode || (part as { executableCode?: unknown; codeExecutionResult?: unknown }).codeExecutionResult) {
    state.codeExecutionParts.push(part as { executableCode?: { code: string }; codeExecutionResult?: { output: string; outcome: string } });
    return;
  }

  // Handle Function Calls (capture thoughtSignature for Gemini 3+)
  const functionCall = (part as { functionCall?: { name?: string; args?: Record<string, unknown> } }).functionCall;
  if (functionCall) {
    state.toolCalls.push({
      functionCall: { name: functionCall.name || '', args: functionCall.args || {} },
      thoughtSignature: (part as { thoughtSignature?: string }).thoughtSignature,
    });
    return;
  }

  // Handle Inline Images (generated by image models)
  const inlineData = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
  if (inlineData?.data && inlineData?.mimeType) {
    state.inlineImages.push({
      mimeType: inlineData.mimeType,
      data: inlineData.data,
    });
    return;
  }

  // Handle Thoughts
  if ((part as { thought?: boolean; text?: string }).thought && (part as { thought?: boolean; text?: string }).text) {
    const text = (part as { text: string }).text;
    state.thoughts += text;
    if (ctx.config.stream) {
      const thoughtChunkEventId = crypto.randomUUID();
      yield {
        type: 'model-thought-chunk',
        eventId: thoughtChunkEventId,
        componentId: thoughtChunkEventId,
        turnId: thoughtChunkEventId,
        role: 'agent',
        sequence: 0,
        timestamp: new Date(),
        data: { thoughts: text, metadata: {} }
      } as SessionEvent;
    }
    return;
  }

  // Handle Message Text
  if ((part as { text?: string }).text) {
    const text = (part as { text: string }).text;
    // Ensure thoughts are finalized before first text chunk
    if (!state.thoughtsFinalized && state.thoughts && ctx.config.stream) {
      const thoughtComponentId = crypto.randomUUID();
      yield* finalizeThoughts(ctx, state, thoughtComponentId);
    }

    state.text += text;
    if (ctx.config.stream) {
      const chunkEventId = crypto.randomUUID();
      yield {
        type: 'model-message-chunk',
        eventId: chunkEventId,
        componentId: chunkEventId,
        turnId: chunkEventId,
        role: 'agent',
        sequence: 0,
        timestamp: new Date(),
        data: { message: text, metadata: {} }
      } as SessionEvent;
    }
  }
}

async function* finalizeThoughts(ctx: ModelCallContext, state: AccumulatedState, componentId: string): AsyncGenerator<SessionEvent> {
  const eventId = crypto.randomUUID();
  yield {
    type: 'model-thought-completed',
    eventId,
    componentId: eventId,
    turnId: eventId,
    role: 'agent',
    sequence: 0,
    timestamp: new Date(),
    data: {
      thoughts: state.thoughts,
      metadata: {}
    }
  } as SessionEvent;
  state.thoughtsFinalized = true;
}

async function* finalizeResponse(ctx: ModelCallContext, state: AccumulatedState) {
  // Finalize thoughts if pending
  if (!state.thoughtsFinalized && state.thoughts) {
    const thoughtComponentId = crypto.randomUUID();
    yield* finalizeThoughts(ctx, state, thoughtComponentId);
  }

  // Build shared metadata for completion events (include model spec for maxTokens)
  const modelSpec = getModelSpec(ctx.config.model);
  const metadata = buildMetadata(state, modelSpec);
  
  // Upload generated images to library (if any and userId available)
  let libraryItemIds: string[] | undefined;
  if (state.inlineImages.length > 0 && ctx.userId) {
    try {
      libraryItemIds = await uploadGeneratedImages(ctx.userId, state.inlineImages);
      console.log(`🖼️ Uploaded ${libraryItemIds?.length || 0} generated image(s) to library`);
    } catch (err) {
      console.error('Failed to upload generated images:', err);
      // Continue without images - they won't appear but response still works
    }
  }
  
  // Yield Message Completed (with libraryItemIds if images were uploaded)
  if (state.text || libraryItemIds?.length) {
    const messageCompletedEventId = crypto.randomUUID();
    yield {
      type: 'model-message-completed',
      eventId: messageCompletedEventId,
      componentId: messageCompletedEventId,
      turnId: messageCompletedEventId,
      role: 'agent',
      sequence: 0,
      timestamp: new Date(),
      data: {
        message: state.text || '',
        metadata,
        ...(libraryItemIds?.length && { libraryItemIds }),
      }
    } as SessionEvent;
  }

  // Yield Tool Calls (with deduplication)
  if (state.toolCalls.length > 0) {
    const componentId = crypto.randomUUID();
    yield* processToolCalls(ctx, state, metadata, componentId);
  }
}

function* processToolCalls(
  ctx: ModelCallContext, 
  state: AccumulatedState,
  metadata: AgentMetadata,
  componentId: string
): Generator<SessionEvent> {
  const uniqueToolCalls = new Map<string, { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }>();

  // Deduplicate (preserve thoughtSignature from first occurrence)
  for (const tc of state.toolCalls) {
    const fc = tc.functionCall;
    const toolInfo = ctx.toolNameMap.get(fc.name);
    if (!toolInfo || !fc.name) {
      console.warn(`⚠️ Skipping invalid tool: ${fc.name || 'unnamed'}`);
      continue;
    }
    
    const argsStr = JSON.stringify(fc.args || {}, Object.keys(fc.args || {}).sort());
    const dedupKey = `${toolInfo.server}:${toolInfo.tool}:${argsStr}`;
    
    if (!uniqueToolCalls.has(dedupKey)) {
      uniqueToolCalls.set(dedupKey, tc);
    }
  }

  // Yield Events (include thoughtSignature for Gemini 3+)
  for (const tc of uniqueToolCalls.values()) {
    const fc = tc.functionCall;
    const toolInfo = ctx.toolNameMap.get(fc.name)!;
    
    const eventId = crypto.randomUUID();
    
    yield {
      type: 'tool-call',
      eventId,
      componentId: eventId,
      turnId: eventId,
      role: 'system',
      sequence: 0,
      timestamp: new Date(),
      data: {
        server: toolInfo.server,
        tool: toolInfo.tool,
        arguments: fc.args || {},
        metadata,
        ...(tc.thoughtSignature && { thoughtSignature: tc.thoughtSignature }),
      }
    } as SessionEvent;
  }
}

// ============================================================
// Image Generation Helpers
// ============================================================

const GENERATED_IMAGES_FOLDER = 'Generated_Images';

/**
 * Upload generated images to library and return asset IDs
 */
async function uploadGeneratedImages(
  userId: string,
  images: Array<{ mimeType: string; data: string }>
): Promise<string[]> {
  if (images.length === 0) return [];
  
  // Get home folder first, then create "Generated Images" inside it
  const homeFolder = await FolderService.getHomeFolder(userId);
  const folder = await FolderService.getOrCreateSystemFolder(
    userId, 
    GENERATED_IMAGES_FOLDER,
    homeFolder.id,
    homeFolder.path
  );
  
  // Upload images in parallel
  const results = await Promise.allSettled(
    images.map(async (img, index) => {
      const asset = await AssetService.createAssetFromBase64(
        userId,
        folder.id,
        img.data,
        img.mimeType,
        `generated_${Date.now()}_${index}.${img.mimeType.split('/')[1] || 'png'}`
      );
      return asset.id;
    })
  );
  
  // Collect successful uploads
  const assetIds: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      assetIds.push(result.value);
    } else {
      console.error('Failed to upload generated image:', result.reason);
    }
  }
  
  return assetIds;
}

// ============================================================
// Helper Functions
// ============================================================

function buildMetadata(state: AccumulatedState, modelSpec?: ModelSpec): AgentMetadata {
  const nativeTools: NativeToolMetadata[] = [];

  // Google Search
  if (state.groundingMetadata?.groundingChunks) {
    nativeTools.push({
      tool: 'googleSearch',
      provider: 'google',
      callsCount: state.groundingMetadata.groundingChunks.length,
      data: {
        groundingMetadata: {
          groundingChunks: state.groundingMetadata.groundingChunks,
          groundingSupports: state.groundingMetadata.groundingSupports,
          webSearchQueries: state.groundingMetadata.webSearchQueries,
        }
      }
    });
  }

  // URL Context
  if (state.urlContextMetadata?.urlMetadata) {
    nativeTools.push({
      tool: 'urlContext',
      provider: 'google',
      callsCount: state.urlContextMetadata.urlMetadata.length,
      data: {
        urlMetadata: state.urlContextMetadata.urlMetadata.map((url: { retrieved_url?: string; retrievedUrl?: string; url_retrieval_status?: string; urlRetrievalStatus?: string }) => ({
          retrievedUrl: url.retrieved_url || url.retrievedUrl,
          urlRetrievalStatus: url.url_retrieval_status || url.urlRetrievalStatus,
        }))
      }
    });
  }

  // Code Execution
  if (state.codeExecutionParts.length > 0) {
    nativeTools.push({
      tool: 'codeExecution',
      provider: 'google',
      callsCount: state.codeExecutionParts.length,
      data: {
        executions: state.codeExecutionParts.map(part => ({
          code: part.executableCode?.code,
          output: part.codeExecutionResult?.output,
          outcome: part.codeExecutionResult?.outcome,
        }))
      }
    });
  }

  return {
    usage: normalizeGeminiUsage(state.usageMetadata, modelSpec?.maxTokens),
    nativeTools: nativeTools.length > 0 ? nativeTools : undefined,
  };
}

/**
 * Normalize Gemini's usage metadata to standard UsageMetrics format
 */
function normalizeGeminiUsage(
  geminiUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number } | undefined,
  maxTokens?: number
): UsageMetrics | undefined {
  if (!geminiUsage) return undefined;
  
  return {
    inputTokens: geminiUsage.promptTokenCount,
    outputTokens: geminiUsage.candidatesTokenCount,
    totalTokens: geminiUsage.totalTokenCount,
    thinkingTokens: geminiUsage.thoughtsTokenCount,
    cacheReadTokens: geminiUsage.cachedContentTokenCount,
    maxTokens,
  };
}

function handleError(e: unknown, attempt: number, maxAttempts: number, keyIndex: number, apiKey: string): boolean {
  const errorMessage = e instanceof Error ? e.message : String(e);
  const errorStr = errorMessage.toLowerCase();
  
  // Transient errors: rate limits, server issues
  const isTransient = [
    '429', '503', 'quota', 'rate limit', 'resource exhausted'
  ].some(s => errorStr.includes(s));
  
  // API key errors: expired, invalid, or authentication issues - always rotate
  const isApiKeyError = [
    'api_key_invalid', 'api key expired', 'api key invalid', 
    'invalid_argument', 'invalid api key', 'authentication'
  ].some(s => errorStr.includes(s));
  
  const shouldRotate = isTransient || isApiKeyError;

  console.error(`❌ Key #${keyIndex + 1} error:`, {
    keySuffix: apiKey.slice(-5),
    message: errorMessage,
    isTransient,
    isApiKeyError
  });

  if (shouldRotate && attempt < maxAttempts - 1) {
    console.log(`🔄 Rotating to next key...`);
    return true; // Retry
  }
  
  return false; // Stop retrying
}

function getModelSpec(modelName: string): ModelSpec {
  if (!(modelName in MODEL_REGISTRY)) {
    console.warn(`⚠️ Unknown model ${modelName}`);
    return {
      id: modelName,
      provider: 'google',
      displayName: modelName,
      capabilities: [],
      maxTokens: 8192,
      supportsStreaming: true
    };
  }
  return MODEL_REGISTRY[modelName];
}

function buildGenerationConfig(
  modelSpec: ModelSpec,
  config: AgentConfig,
  toolNameMap: Map<string, { server: string; tool: string }>
): Record<string, unknown> {
  const tools: Array<{ functionDeclarations?: unknown[]; googleSearch?: Record<string, never>; urlContext?: Record<string, never>; codeExecution?: Record<string, never> }> = [];
  const supportsToolCalling = modelSpec.capabilities.includes(ModelCapability.TOOL_CALLING);

  // Add MCP Tools (only if model supports tool calling)
  if (supportsToolCalling && config.enableTools && config.availableTools.length > 0) {
    const functionDeclarations = config.availableTools.map(tool => {
      const formattedName = formatToolName(tool.server, tool.tool);
      toolNameMap.set(formattedName, { server: tool.server, tool: tool.tool });
      return {
        name: formattedName,
        description: tool.description,
        parameters: tool.inputSchema,
      };
    });
    tools.push({ functionDeclarations });
  }

  // Add Native Tools (only if model supports tool calling)
  if (supportsToolCalling) {
    config.selectedNativeTools.forEach(tool => {
      if (tool.id === 'googleSearch') tools.push({ googleSearch: {} });
      if (tool.id === 'urlContext') tools.push({ urlContext: {} });
      if (tool.id === 'codeExecution') tools.push({ codeExecution: {} });
    });
  }

  const genConfig: Record<string, unknown> = {
    temperature: config.temperature,
    topP: config.topP,
    maxOutputTokens: config.maxOutputTokens,
  };

  if (tools.length > 0) genConfig.tools = tools;
  if (config.systemInstructions) genConfig.systemInstruction = config.systemInstructions;
  
  // Structured output config (for JSON responses)
  if (config.responseSchema) {
    genConfig.responseSchema = config.responseSchema;
    genConfig.responseMimeType = config.responseMimeType || 'application/json';
  }
  
  // Thinking Config
  if (config.enableThinking && modelSpec.capabilities.includes('thinking' as ModelCapability)) {
    genConfig.thinkingConfig = {
      includeThoughts: config.includeThoughtsInResponse,
      thinkingBudget: config.thinkingBudget || -1,
    };
  }
  
  // Image Generation Config - enable image output for image-capable models
  if (modelSpec.capabilities.includes(ModelCapability.IMAGE_GENERATION)) {
    genConfig.responseModalities = ['TEXT', 'IMAGE'];
  }

  return genConfig;
}

function formatToolName(server: string, tool: string): string {
  const normTool = tool.replace(/-/g, '_');
  const normServer = server.replace(/-/g, '_');
  if (normTool.startsWith(normServer + '_')) return normTool;
  return `${normServer}_${normTool}`;
}
