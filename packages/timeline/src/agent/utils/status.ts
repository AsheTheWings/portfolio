/**
 * status — Two-axis status model for the session UI.
 *
 *   WorkflowStatus  — session-scoped, mirrors the active run's lifecycle.
 *   AgentStatus     — per-participant within the active run.
 *
 * Both are ephemeral (never persisted). They are derived from the same
 * event stream in two complementary ways:
 *   1. Live: `store.appendEvent` calls `workflowStatusFromEvent` /
 *      `agentStatusFromEvent` on each incoming event.
 *   2. Cold: on session load, `deriveWorkflowStatus` /
 *      `deriveAgentStatuses` reconstruct from the persisted log.
 *
 * The canonical state lives in the `workflow_*` system events on the
 * session_event stream.
 */

import type { SessionEvent, Agent } from '../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Session-scoped lifecycle of the active workflow run.
 *
 *   idle       — no active run (initial, or last run terminated).
 *   running    — a run is executing (workflow_started / workflow_resumed seen).
 *   paused     — run is suspended awaiting user feedback.
 *   completed  — last run finished cleanly.
 *   aborted    — last run was cancelled (user-initiated).
 *   failed     — last run errored.
 *   uncertain  — the server could not durably commit the terminal state;
 *                synchronization and recovery are required.
 */
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'failed'
  | 'uncertain';

/**
 * Per-agent runtime status. Distinct from WorkflowStatus — describes what
 * a specific agent is doing inside the run, not the run itself.
 *
 *   idle             — no activity / not started.
 *   processing       — priming for next model call (post-tool-result, or run start).
 *   thinking         — model-thought streaming.
 *   responding       — model-message streaming.
 *   toolCalling      — awaiting tool result.
 *   waitingFeedback  — a tool-call requires user input.
 *   aborted          — the run was aborted while this agent was active.
 */
export type AgentStatus =
  | 'idle'
  | 'processing'
  | 'thinking'
  | 'responding'
  | 'toolCalling'
  | 'waitingFeedback'
  | 'aborted';

/** Statuses that represent the agent actively producing output. */
export const ACTIVE_STATUSES: readonly AgentStatus[] = [
  'processing',
  'thinking',
  'responding',
  'toolCalling',
] as const;

/** WorkflowStatus values that imply the run has finished. */
export const WORKFLOW_TERMINAL_STATUSES: readonly WorkflowStatus[] = [
  'completed',
  'aborted',
  'failed',
] as const;

export function isWorkflowActive(s: WorkflowStatus): boolean {
  return s === 'running';
}

export function isWorkflowTerminal(s: WorkflowStatus): boolean {
  return WORKFLOW_TERMINAL_STATUSES.includes(s);
}

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

/** True if any agent is actively producing output (processing/thinking/
 *  responding/toolCalling). Mostly useful for per-agent UI; for "is the
 *  whole run live?" use `isWorkflowActive(workflowStatus)` instead. */
export function hasActiveAgent(statuses: Record<string, AgentStatus>): boolean {
  return hasAgentStatus(statuses, ...ACTIVE_STATUSES);
}

// ────────────────────────────────────────────────────────────
// Cold derivation from event history
// ────────────────────────────────────────────────────────────

// Event-type predicates (used by both live and cold derivation).
const SYSTEM_FILTER_TYPES = new Set<SessionEvent['type']>([
  'session_branched',
  'workflow_started',
  'workflow_resumed',
  'workflow_paused',
  'workflow_completed',
  'workflow_aborted',
  'workflow_failed',
]);

/**
 * Derive the workflow status from the event log.
 *
 * Walks the events newest-first, looking for the most recent run-lifecycle
 * marker. Pause/resume reuse the same runId, so we have to honour the
 * latest marker rather than just the first terminal we see.
 */
export function deriveWorkflowStatus(events: SessionEvent[]): WorkflowStatus {
  for (let i = events.length - 1; i >= 0; i--) {
    switch (events[i].type) {
      case 'workflow_started':
      case 'workflow_resumed':
        return 'running';
      case 'workflow_paused':
        return 'paused';
      case 'workflow_completed':
        return 'completed';
      case 'workflow_aborted':
        return 'aborted';
      case 'workflow_failed':
        return 'failed';
    }
  }
  return 'idle';
}

/**
 * Derive per-agent statuses from the persisted event stream.
 *
 * Decision tree per agent:
 *   workflow last terminated as 'aborted' and the agent had any in-flight
 *     activity (no trailing agent-turn-completed) → 'aborted'
 *   no events for this agent → 'idle'
 *   last non-system event is agent-turn-completed → 'idle'
 *   last non-system event is tool-effects with pending userActions → 'waitingFeedback'
 *   anything else (mid-turn) → 'processing'
 */
export function deriveAgentStatuses(
  events: SessionEvent[],
  agents: Agent[],
): Record<string, AgentStatus> {
  const statuses: Record<string, AgentStatus> = {};
  for (const a of agents) statuses[a.agentId] = 'idle';

  if (events.length === 0) return statuses;

  const workflowStatus = deriveWorkflowStatus(events);

  // Per-agent: walk each agent's last non-system event independently.
  const knownIds = new Set(agents.map((a) => a.agentId));
  for (const e of events) {
    if (e.agentId) knownIds.add(e.agentId);
  }

  for (const agentId of knownIds) {
    const lastForAgent = events.findLast(
      (e) => (e.agentId || 'none') === agentId && !SYSTEM_FILTER_TYPES.has(e.type),
    );

    if (!lastForAgent) {
      statuses[agentId] = 'idle';
      continue;
    }

    if (lastForAgent.type === 'agent-turn-completed') {
      statuses[agentId] = 'idle';
      continue;
    }

    // Pending user feedback linked to this agent's tool-call.
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

    // Mid-turn with no clean termination: 'aborted' iff the run was
    // aborted, otherwise 'processing' (the run is still alive or paused).
    statuses[agentId] = workflowStatus === 'aborted' ? 'aborted' : 'processing';
  }

  return statuses;
}

// ────────────────────────────────────────────────────────────
// Event → status mapping (used by store.appendEvent)
// ────────────────────────────────────────────────────────────

/**
 * Map a single event to the per-agent status it implies for its emitting agent.
 * Returns null if the event doesn't affect a specific agent's status.
 *
 * Session-scoped events (workflow lifecycle, user-input-committed,
 * session_branched) are handled by the caller via
 * `applyAgentStatusesForLifecycleEvent` because they affect every agent.
 */
export function agentStatusFromEvent(event: SessionEvent): AgentStatus | null {
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

/**
 * Map a single event to the workflow status it implies. Returns null if
 * the event doesn't move the workflow state machine.
 */
export function workflowStatusFromEvent(event: SessionEvent): WorkflowStatus | null {
  switch (event.type) {
    case 'workflow_started':
    case 'workflow_resumed':
      return 'running';
    case 'workflow_paused':
      return 'paused';
    case 'workflow_completed':
      return 'completed';
    case 'workflow_aborted':
      return 'aborted';
    case 'workflow_failed':
      return 'failed';
    default:
      return null;
  }
}

/**
 * Bulk per-agent status update for session-scoped lifecycle events.
 * Returns the new statuses map (or null if no change).
 *
 *   workflow_started / workflow_resumed → every known agent → 'processing'
 *   workflow_aborted                    → every active agent → 'aborted'
 *   workflow_completed / workflow_failed → every active agent → 'idle'
 */
export function applyAgentStatusesForLifecycleEvent(
  current: Record<string, AgentStatus>,
  event: SessionEvent,
  agents: Agent[],
): Record<string, AgentStatus> | null {
  switch (event.type) {
    case 'workflow_started':
    case 'workflow_resumed': {
      const next = { ...current };
      for (const a of agents) next[a.agentId] = 'processing';
      return next;
    }
    case 'workflow_aborted': {
      const next = { ...current };
      for (const id of Object.keys(next)) {
        if (next[id] !== 'idle') next[id] = 'aborted';
      }
      return next;
    }
    case 'workflow_completed':
    case 'workflow_failed': {
      const next = { ...current };
      for (const id of Object.keys(next)) next[id] = 'idle';
      return next;
    }
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
