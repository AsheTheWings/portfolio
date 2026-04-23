/**
 * agent-status — Per-agent runtime status types, helpers, and derivation.
 *
 * Replaces the previous single global `conversationStatus`. Each agent in a
 * session has its own status; UI code reads the specific agent's status
 * (for per-bubble indicators) or uses the helpers below to aggregate over
 * all active agents (for global indicators like the input bar).
 *
 * Status is ephemeral — it is never persisted. It is either:
 *   1. Updated incrementally in `store.appendEvent` as events stream in.
 *   2. Reset on WS `agent_status: completed`.
 *   3. Cold-derived from the event history on session load / abort recovery
 *      via `deriveAgentStatuses`.
 */

import type { AgentSessionEvent, Agent } from '../types';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type AgentStatus =
  | 'idle'
  | 'processing'
  | 'thinking'
  | 'responding'
  | 'toolCalling'
  | 'waitingFeedback'
  | 'paused'
  | 'interrupted';

/** Statuses that represent the agent actively producing output. */
export const ACTIVE_STATUSES: readonly AgentStatus[] = [
  'processing',
  'thinking',
  'responding',
  'toolCalling',
] as const;

// ────────────────────────────────────────────────────────────
// Aggregation helpers (replace the old global derivation)
// ────────────────────────────────────────────────────────────

/** Safe lookup for a specific agent's status. Defaults to 'idle'. */
export function getAgentStatus(
  statuses: Record<string, AgentStatus>,
  agentId?: string,
): AgentStatus {
  return statuses[agentId || 'none'] ?? 'idle';
}

/** True if any agent is in one of the target statuses. */
export function hasAgentStatus(
  statuses: Record<string, AgentStatus>,
  ...target: AgentStatus[]
): boolean {
  const set = new Set(target);
  for (const s of Object.values(statuses)) {
    if (set.has(s)) return true;
  }
  return false;
}

/** True if any agent is actively working (processing/thinking/responding/toolCalling). */
export function hasActiveAgent(statuses: Record<string, AgentStatus>): boolean {
  return hasAgentStatus(statuses, ...ACTIVE_STATUSES);
}

// ────────────────────────────────────────────────────────────
// Cold derivation from event history
// ────────────────────────────────────────────────────────────

/**
 * Derive per-agent statuses from the persisted event stream.
 *
 * Decision tree per agent:
 *   no events for this agent → 'idle'
 *   last event is agent-turn-completed → 'idle'
 *   last event is tool-effects with pending userActions → 'waitingFeedback'
 *   any other terminal-looking event (tool-call mid-flight, message etc.)
 *     → if there is a later agent-turn-completed anywhere, 'idle'; otherwise 'paused'
 *
 * For `user-turn-completed` (which is session-scoped, not per-agent), every
 * known agent is considered 'interrupted' — a turn was started but no agent
 * produced anything yet. Callers pass the current agents list to know which
 * IDs to materialize.
 */
export function deriveAgentStatuses(
  events: AgentSessionEvent[],
  agents: Agent[],
): Record<string, AgentStatus> {
  const statuses: Record<string, AgentStatus> = {};
  for (const a of agents) statuses[a.agentId] = 'idle';

  if (events.length === 0) return statuses;

  const lastNonBranch = events.findLast((e) => e.type !== 'branch');
  if (!lastNonBranch) return statuses;

  // Session-level: user turn started, no agent events yet → all agents interrupted
  if (lastNonBranch.type === 'user-turn-completed') {
    for (const a of agents) statuses[a.agentId] = 'interrupted';
    return statuses;
  }

  // Per-agent: walk each agent's last event independently
  const knownIds = new Set(agents.map((a) => a.agentId));
  // Also include any agent ids seen in events (e.g. after session load before
  // agents list hydrated) so we don't silently drop their status.
  for (const e of events) {
    if (e.agentId) knownIds.add(e.agentId);
  }

  for (const agentId of knownIds) {
    const lastForAgent = events.findLast(
      (e) => (e.agentId || 'none') === agentId && e.type !== 'branch',
    );
    if (!lastForAgent) {
      statuses[agentId] = 'idle';
      continue;
    }

    if (lastForAgent.type === 'agent-turn-completed') {
      statuses[agentId] = 'idle';
      continue;
    }

    // Pending user feedback linked to this agent's tool-call
    if (lastForAgent.type === 'tool-effects') {
      const toolEffects = (lastForAgent.data as { toolEffects?: { userActions?: unknown } })
        .toolEffects;
      if (toolEffects?.userActions && lastForAgent.toolCallEventId) {
        const hasFeedback = events.some(
          (e) =>
            e.type === 'user-feedback-result' &&
            e.toolCallEventId === lastForAgent.toolCallEventId,
        );
        if (!hasFeedback) {
          statuses[agentId] = 'waitingFeedback';
          continue;
        }
      }
    }

    // Any other event mid-turn → agent was paused/interrupted
    statuses[agentId] = 'paused';
  }

  return statuses;
}

// ────────────────────────────────────────────────────────────
// Event → status mapping (used by store.appendEvent)
// ────────────────────────────────────────────────────────────

/**
 * Map a single event to the status it implies for its emitting agent.
 * Returns null if the event doesn't affect status.
 *
 * Session-level events (`user-turn-completed`) are handled by the caller,
 * since they affect all agents rather than just one.
 */
export function statusFromEvent(event: AgentSessionEvent): AgentStatus | null {
  switch (event.type) {
    case 'model-thought-chunk':
    case 'model-thought-completed':
      return 'thinking';
    case 'model-message-chunk':
    case 'model-message-completed':
      return 'responding';
    case 'tool-call':
      return 'toolCalling';
    case 'tool-result':
    case 'tool-effects':
      // After tool execution completes, the agent is preparing its next
      // model call — treat as processing until the next chunk lands.
      return 'processing';
    case 'agent-turn-completed':
      return 'idle';
    default:
      return null;
  }
}

/** Short human-readable label for a status, used in streaming UI. */
export function statusLabel(status: AgentStatus): string | undefined {
  switch (status) {
    case 'thinking':
      return 'Thinking';
    case 'responding':
      return 'Responding';
    case 'toolCalling':
      return 'Calling tools';
    case 'processing':
      return 'Processing';
    default:
      return undefined;
  }
}
