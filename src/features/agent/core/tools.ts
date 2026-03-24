/**
 * Agent Tools Execution Service
 * Stateless tool execution logic extracted from Session
 */

import type {
  SessionEvent,
  ToolCallEvent,
  Tool,
  AgentMetadata,
  ToolEffects,
  AgentConfig,
} from '../types';
import { getMcpClient, getJobsManager } from './sessions-manager';

// ============================================================
// Metrics Utilities
// ============================================================

/**
 * Round metric to 2 decimal places
 */
function roundMetric(value: number | undefined): number | undefined {
  return value !== undefined ? Math.round(value * 100) / 100 : undefined;
}

/**
 * Execute pending tool calls from event history
 * Stateless - reads from event history, yields new events
 * Session tracks pending state via event history
 * 
 * @param turnEvents - Events from current agent turn
 * @param availableTools - Tool definitions with handlers
 * @param maxConcurrentTools - Batch size for parallel execution
 * @param turnId - Turn ID from session context
 * @param agentConfig - Agent configuration for tool context
 * @param turnMetadata - Turn-scoped metadata for tool context
 */
export async function* executeTools(
  turnEvents: SessionEvent[],
  availableTools: Tool[],
  maxConcurrentTools: number,
  turnId?: string,
  agentConfig?: AgentConfig,
  turnMetadata?: AgentMetadata
): AsyncGenerator<SessionEvent> {

  // Extract pending tool calls (tool-call without tool-result)
  const pendingToolCallEvents = getPendingToolCalls(turnEvents);
  
  // No pending tools - return
  if (pendingToolCallEvents.length === 0) {
    return;
  }

  // Group tools by feedback requirements
  // Tools with existing tool-effects userActions but no feedback result are waiting
  const { needsFeedback, readyToExecute } = groupToolsByFeedback(
    pendingToolCallEvents,
    turnEvents
  );

  // If tools are waiting for feedback, exit - the tool-effects event was already
  // emitted during execution, useToolEffects will have triggered stopAgent
  if (needsFeedback.length > 0) {
    return;
  }

  // Execute ready tools concurrently
  if (readyToExecute.length > 0) {
    yield* executeToolsConcurrently(
      readyToExecute,
      availableTools,
      maxConcurrentTools,
      turnEvents,
      turnId,
      agentConfig,
      turnMetadata
    );
  }
}

/**
 * Get turn events (events since last user-turn-completed)
 */
export function getTurnEvents(sessionEvents: SessionEvent[]): SessionEvent[] {
  const lastUserTurn = sessionEvents.findLast(e => e.type === 'user-turn-completed');
  if (!lastUserTurn) return sessionEvents;
  return sessionEvents.filter(e => e.sequence >= lastUserTurn.sequence);
}

/**
 * Extract pending tool calls from current turn
 */
export function getPendingToolCalls(turnEvents: SessionEvent[]): ToolCallEvent[] {
  const pending: ToolCallEvent[] = [];
  const processedComponentIds = new Set<string>();

  // Build set of component IDs that have tool-result
  for (const event of turnEvents) {
    if (event.type === 'tool-result') {
      processedComponentIds.add(event.componentId);
    }
  }

  // Find tool-call events without corresponding tool-result
  for (const event of turnEvents) {
    if (event.type === 'tool-call' && !processedComponentIds.has(event.componentId)) {
      pending.push(event);
    }
  }

  return pending;
}

/**
 * Group tools by whether they need user feedback
 * 
 * A tool needs feedback if:
 * 1. There's a tool-effects event with userActions for this componentId
 * 2. No user-feedback-result event exists for this componentId
 * 
 * This is a resume scenario where tool already ran, emitted tool-effects,
 * and we're now checking if user feedback was provided.
 */
function groupToolsByFeedback(
  toolCalls: ToolCallEvent[],
  turnEvents: SessionEvent[]
): {
  needsFeedback: ToolCallEvent[];
  readyToExecute: ToolCallEvent[];
} {
  const needsFeedback: ToolCallEvent[] = [];
  const readyToExecute: ToolCallEvent[] = [];

  // Build maps for tool-effects with userActions and feedback results
  const pendingUserActions = new Map<string, boolean>();
  const feedbackResults = new Map<string, unknown>();
  
  for (const event of turnEvents) {
    if (event.type === 'tool-effects') {
      const toolEffects = (event.data as { toolEffects?: { userActions?: unknown } }).toolEffects || {};
      if (toolEffects.userActions) {
        pendingUserActions.set(event.componentId, true);
      }
    }
    if (event.type === 'user-feedback-result') {
      feedbackResults.set(event.componentId, (event.data as { result?: unknown }).result);
    }
  }

  for (const tc of toolCalls) {
    // Check if this tool has pending userActions waiting for feedback
    const hasPendingUserActions = pendingUserActions.has(tc.componentId);
    const hasFeedback = feedbackResults.has(tc.componentId);
    
    if (hasPendingUserActions && !hasFeedback) {
      // Tool emitted userActions but no feedback yet - still waiting
      needsFeedback.push(tc);
    } else {
      // Either no userActions, or feedback already provided
      readyToExecute.push(tc);
    }
  }

  return { needsFeedback, readyToExecute };
}

/**
 * Execute tools concurrently in batches
 */
async function* executeToolsConcurrently(
  toolCalls: ToolCallEvent[],
  availableTools: Tool[],
  maxConcurrent: number,
  turnEvents: SessionEvent[],
  turnId?: string,
  agentConfig?: AgentConfig,
  turnMetadata?: AgentMetadata
): AsyncGenerator<SessionEvent> {

  // Execute in batches
  for (let i = 0; i < toolCalls.length; i += maxConcurrent) {
    const batch = toolCalls.slice(i, i + maxConcurrent);

    // Execute batch in parallel
    const results = await Promise.allSettled(
      batch.map(tc => executeSingleTool(tc, availableTools, turnEvents, turnId, agentConfig, turnMetadata))
    );

    // Yield results (may be single event or array of [tool-effects, tool-result])
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const tc = batch[j];

      let resultEvents: SessionEvent | SessionEvent[];

      if (result.status === 'fulfilled') {
        resultEvents = result.value;
      } else {
        const errorMsg = result.reason?.message || String(result.reason);
        resultEvents = buildToolResultEvent(tc, null, errorMsg);
      }

      // Yield single or multiple events
      if (Array.isArray(resultEvents)) {
        for (const event of resultEvents) {
          yield event;
        }
      } else {
        yield resultEvents;
      }
    }
  }
}

/**
 * Execute a single tool with timing
 * Returns single event or array [tool-effects, tool-result] if effects present
 */
export async function executeSingleTool(
  toolCall: ToolCallEvent,
  availableTools: Tool[],
  turnEvents: SessionEvent[],
  turnId?: string,
  agentConfig?: AgentConfig,
  turnMetadata?: AgentMetadata
): Promise<SessionEvent | SessionEvent[]> {
  const startTime = performance.now();
  
  try {
    const toolDef = availableTools.find(
      t => t.server === toolCall.data.server && t.tool === toolCall.data.tool
    );

    if (!toolDef) {
      return buildToolResultEvent(
        toolCall,
        null,
        `Tool not found: ${toolCall.data.server}:${toolCall.data.tool}`
      );
    }

    let result: unknown;

    // Execute tool based on source
    if (toolDef.source === 'builtIn' && toolDef.handler) {
      const feedbackResult = turnEvents
        .filter(e => e.type === 'user-feedback-result' && e.componentId === toolCall.componentId)
        .map(e => (e.data as { result?: unknown }).result)[0];

      result = await toolDef.handler(toolCall.data.arguments || {}, {
        agentConfig,
        userFeedback: feedbackResult,
        componentId: toolCall.componentId,
        jobsManager: getJobsManager(),
        turnId,
        turnMetadata,
      });
    } else if (toolDef.source === 'localMCPHost') {
      const mcpClient = getMcpClient();
      if (!mcpClient) {
        return buildToolResultEvent(
          toolCall,
          null,
          'MCP client not connected'
        );
      }

      result = await mcpClient.executeTool(
        toolCall.data.server,
        toolCall.data.tool,
        toolCall.data.arguments || {},
        30000
      );
    } else {
      return buildToolResultEvent(
        toolCall,
        null,
        `Unknown tool source: ${toolDef.source}`
      );
    }

    const toolExecutionDuration = roundMetric(performance.now() - startTime);
    
    // Emit raw per-tool metadata
    const rawMetadata: AgentMetadata = {
      toolExecutionDuration,
    };

    return buildToolResultEvent(toolCall, result, undefined, rawMetadata);
  } catch (err: unknown) {
    const toolExecutionDuration = roundMetric(performance.now() - startTime);
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    const rawMetadata: AgentMetadata = {
      toolExecutionDuration,
    };

    return buildToolResultEvent(toolCall, null, errorMsg, rawMetadata);
  }
}

/**
 * Build tool result event from execution
 * Returns both tool-effects and tool-result events if toolEffects present
 */
export function buildToolResultEvent(
  toolCall: ToolCallEvent,
  result: unknown,
  error?: string,
  metadata?: AgentMetadata
): SessionEvent | SessionEvent[] {
  // Extract effects from result
  let toolEffects: ToolEffects | undefined = undefined;
  let cleanResult = result;

  if (result && typeof result === 'object' && (result as { toolEffects?: ToolEffects }).toolEffects) {
    toolEffects = (result as { toolEffects: ToolEffects }).toolEffects;
    const { toolEffects: _, ...rest } = result as { toolEffects: ToolEffects; [key: string]: unknown };
    cleanResult = rest;
  }

  const toolResultEvent: SessionEvent = {
    type: 'tool-result',
    eventId: crypto.randomUUID(),
    componentId: toolCall.componentId,
    role: 'agent',
    data: {
      server: toolCall.data.server,
      tool: toolCall.data.tool,
      arguments: toolCall.data.arguments || {},
      result: error ? { status: 'error', message: error } : cleanResult,
      metadata: metadata || {},
    },
  } as SessionEvent;

  // If there are toolEffects, emit them as separate event before tool-result
  if (toolEffects && Object.keys(toolEffects).length > 0) {
    const toolEffectsEvent: SessionEvent = {
      type: 'tool-effects',
      eventId: crypto.randomUUID(),
      componentId: toolCall.componentId,
      role: 'agent',
      data: {
        server: toolCall.data.server,
        tool: toolCall.data.tool,
        toolEffects,
        metadata: metadata || {},
      },
    } as SessionEvent;

    return [toolEffectsEvent, toolResultEvent];
  }

  return toolResultEvent;
}


