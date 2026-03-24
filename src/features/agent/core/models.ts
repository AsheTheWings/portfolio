/**
 * Agent Model Service
 * Stateless model API calls - emits raw per-call metrics
 */

import type { 
  AgentConfig, 
  AgentMetadata, 
  SessionEvent,
} from '../types';

// ============================================================
// Metrics Utilities
// ============================================================

/**
 * Round metric to 2 decimal places
 */
function roundMetric(value: number | undefined): number | undefined {
  return value !== undefined ? Math.round(value * 100) / 100 : undefined;
}

// ============================================================
// Model Call Service
// ============================================================

/**
 * Call model with session events and agent config
 * Emits raw per-call metrics - caller (callAgent) handles:
 *   - sequence/timestamp assignment
 *   - metadata aggregation
 */
export async function* callModel(
  sessionEvents: SessionEvent[],
  agentConfig?: AgentConfig,
  signal?: AbortSignal
): AsyncGenerator<SessionEvent> {
  // Resolve Agent Config if not provided
  let resolvedConfig = agentConfig;
  if (!resolvedConfig) {
      const lastUserTurn = sessionEvents.findLast(e => e.type === 'user-turn-completed');
      if (lastUserTurn && (lastUserTurn.data as any).agentConfig) {
          resolvedConfig = (lastUserTurn.data as any).agentConfig;
      } else {
          throw new Error('Agent config not provided and could not be resolved from history');
      }
  }

  // Component IDs for grouping related events
  const thoughtsComponentId = crypto.randomUUID();
  const messageComponentId = crypto.randomUUID();

  // Metrics tracking (per-call, not aggregated)
  const callStart = performance.now();
  let durationEmitted = false;

  // Call API with session events
  const response = await fetch('/api/agent/call-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionEvents, agentConfig: resolvedConfig }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Model call failed');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Stream response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const payload = JSON.parse(line.slice(6));

        // Process and enrich events with raw per-call metrics
        switch (currentEvent) {
          case 'model-thought-chunk': {
            yield {
              type: 'model-thought-chunk',
              eventId: crypto.randomUUID(),
              componentId: thoughtsComponentId,
              role: 'agent',
              data: { ...payload.data },
            } as SessionEvent;
            break;
          }
          
          case 'model-thought-completed': {
            yield {
              type: 'model-thought-completed',
              eventId: crypto.randomUUID(),
              componentId: thoughtsComponentId,
              role: 'agent',
              data: { ...payload.data },
            } as SessionEvent;
            break;
          }
          
          case 'model-message-chunk': {
            yield {
              type: 'model-message-chunk',
              eventId: crypto.randomUUID(),
              componentId: messageComponentId,
              role: 'agent',
              data: { ...payload.data },
            } as SessionEvent;
            break;
          }
          
          case 'model-message-completed':
          case 'tool-call': {
            // Only first terminal event gets modelCallDuration (avoids duplication across multiple tool calls)
            const rawMetadata: AgentMetadata = { ...payload.data.metadata };
            if (!durationEmitted) {
              rawMetadata.modelCallDuration = roundMetric(performance.now() - callStart);
              durationEmitted = true;
            }
            
            if (currentEvent === 'model-message-completed') {
              yield {
                type: 'model-message-completed',
                eventId: crypto.randomUUID(),
                componentId: messageComponentId,
                role: 'agent',
                data: {
                  ...payload.data,
                  metadata: rawMetadata,
                },
              } as SessionEvent;
            } else {
              yield {
                type: 'tool-call',
                eventId: crypto.randomUUID(),
                componentId: crypto.randomUUID(),
                role: 'agent',
                data: {
                  ...payload.data,
                  metadata: rawMetadata,
                },
              } as SessionEvent;
            }
            break;
          }
        }

        currentEvent = '';
      }
    }
  }
}
