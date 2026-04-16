/**
 * derive-conversation-status — Cold status derivation from event stream
 *
 * Pure function that determines conversation status by inspecting the last
 * meaningful event. Used for:
 * - Session load (hydration) in useAgentSessionLifecycle
 * - Re-derivation after WS abort/error signals in useWsEventIngestion
 *
 * NOT used for live/transient statuses — those are driven by
 * store.appendEvent() on each incoming WS event.
 *
 * Post spec-20260409-1: uses toolCallEventId (not componentId) for
 * feedback linkage. Reads from agentSessionEvents[] (store source of truth).
 */

import type { AgentSessionEvent } from '../types';
import type { AgentState } from '../types';

type ConversationStatus = AgentState['conversationStatus'];

/**
 * Derive conversation status from the persisted event stream.
 *
 * Decision tree:
 *   no events → 'healthy'
 *   lastNonBranch is agent-turn-completed → 'healthy'
 *   lastNonBranch is user-turn-completed → 'interrupted'
 *   lastNonBranch is tool-effects with userActions (no feedback yet) → 'waitingFeedback'
 *   anything else (agent mid-work) → 'paused'
 */
export function deriveConversationStatus(events: AgentSessionEvent[]): ConversationStatus {
  if (events.length === 0) return 'healthy';

  const lastNonBranch = events.findLast(e => e.type !== 'branch');
  if (!lastNonBranch) return 'healthy';

  if (lastNonBranch.type === 'agent-turn-completed') return 'healthy';
  if (lastNonBranch.type === 'user-turn-completed') return 'interrupted';

  // Check for pending feedback: tool-effects with userActions and no feedback result
  if (lastNonBranch.type === 'tool-effects') {
    const toolEffects = (lastNonBranch.data as { toolEffects?: { userActions?: unknown } }).toolEffects;
    if (toolEffects?.userActions && lastNonBranch.toolCallEventId) {
      const hasFeedback = events.some(
        e => e.type === 'user-feedback-result' && e.toolCallEventId === lastNonBranch.toolCallEventId,
      );
      if (!hasFeedback) return 'waitingFeedback';
    }
  }

  // Any other agent event that isn't turn-completed → paused
  return 'paused';
}
