/**
 * toAgentSessionComponents — Interface-based event → component derivation
 *
 * Pure functions (no hooks, no state) that transform events into components
 * per active UI interface. Used internally by the store.
 *
 * Chat mode: Groups agent events into composite 'agent-message' components
 * with arrow-based carousel navigation. Response-bounded grouping — sealed
 * by model-message-completed (hasResponse = true).
 *
 * Flat mode: Maps each meaningful event to its own standalone component.
 * No composites, no grouping. Designed for debugging and raw event inspection.
 */

import type {
  AgentSessionEvent,
  AgentSessionComponent,
  AgentSessionComponentData,
  UIInterface,
} from '../types';

// ============================================================
// Public API
// ============================================================

/** Type guard: does a feedback result contain user-typed text? */
export function isTextFeedback(result: unknown): result is { userFeedback: string } {
  return (
    typeof result === 'object' && result !== null &&
    'userFeedback' in result &&
    typeof (result as { userFeedback: unknown }).userFeedback === 'string' &&
    (result as { userFeedback: string }).userFeedback.trim().length > 0
  );
}

/**
 * Batch: build all components from ordered events per interface.
 * Used for hydration and UI interface changes.
 */
export function toAgentSessionComponents(
  events: AgentSessionEvent[],
  uiInterface: UIInterface,
): AgentSessionComponent[] {
  const components: AgentSessionComponent[] = [];
  for (const event of events) {
    processEventIntoComponents(components, event, uiInterface);
  }
  return components;
}

/**
 * Incremental: apply one event to existing components per interface.
 * Used for live event processing.
 */
export function processEventIntoComponents(
  components: AgentSessionComponent[],
  event: AgentSessionEvent,
  uiInterface: UIInterface,
): void {
  switch (uiInterface) {
    case 'chat':
      processEventForChat(components, event);
      break;
    case 'flat':
      processEventForFlat(components, event);
      break;
  }
}

// ============================================================
// Immutability Helpers (Zustand / React.memo compatibility)
// ============================================================

/**
 * Clone-on-mutate for an agent-message composite at a known index.
 * Returns the cloned composite (already replaced in the array).
 * Only the items array and sessionEvents array get new references;
 * individual items remain the same objects until touchItem() is called.
 */
function touchComposite(
  components: AgentSessionComponent[],
  index: number,
): AgentSessionComponent {
  const c = components[index];
  const clone: AgentSessionComponent = {
    ...c,
    data: {
      ...c.data,
      items: c.data.items ? [...c.data.items] : undefined,
      sessionEvents: c.data.sessionEvents ? [...c.data.sessionEvents] : undefined,
    },
  };
  components[index] = clone;
  return clone;
}

/**
 * Clone a sub-item within a composite's items array for safe mutation.
 * Returns the cloned item (already replaced in the items array).
 */
function touchItem(
  composite: AgentSessionComponent,
  itemIndex: number,
): AgentSessionComponent {
  const items = composite.data.items!;
  const clone = { ...items[itemIndex], data: { ...items[itemIndex].data } };
  items[itemIndex] = clone;
  return clone;
}

/**
 * Find a composite by backwards search and touch it for mutation.
 * Returns [composite, compositeIndex] or [null, -1] if not found.
 */
function touchCompositeWithToolCall(
  components: AgentSessionComponent[],
  toolCallEventId: string | undefined,
): [AgentSessionComponent | null, number] {
  if (!toolCallEventId) return [null, -1];
  for (let i = components.length - 1; i >= 0; i--) {
    const c = components[i]!;
    if (c.type !== 'agent-message') continue;
    const itemIdx = c.data.items!.findIndex(
      (item) => item.type === 'tool-call' && item.id === toolCallEventId,
    );
    if (itemIdx >= 0) {
      const composite = touchComposite(components, i);
      const item = touchItem(composite, itemIdx);
      return [composite, itemIdx];
    }
  }
  return [null, -1];
}

// ============================================================
// Chat Mode Derivation
// ============================================================

/**
 * Chat mode groups agent events into composite 'agent-message' components —
 * one per agent per response group. A group is sealed when
 * model-message-completed sets hasResponse = true; subsequent agent events
 * start a new composite.
 *
 * User events, user-feedback, and system components pass through as
 * individual entries.
 */
function processEventForChat(
  components: AgentSessionComponent[],
  event: AgentSessionEvent,
): void {
  switch (event.type) {
    // ── User turn ──────────────────────────────────────────
    case 'user-turn-completed': {
      const data = event.data as unknown as AgentSessionComponentData;
      components.push({
        id: event.eventId,
        type: 'user-message',
        role: 'user',
        isStreaming: false,
        data: { ...data, sessionEvents: [event] },
      });
      break;
    }

    // ── Thought streaming ──────────────────────────────────
    case 'model-thought-chunk': {
      const composite = findOrCreateAgentMessage(components, event);
      const items = composite.data.items!;
      const lastThoughtIdx = items.findLastIndex(
        (c) => c.type === 'agent-thoughts' && c.isStreaming,
      );
      if (lastThoughtIdx >= 0) {
        const lastThought = touchItem(composite, lastThoughtIdx);
        lastThought.data.thoughts = (lastThought.data.thoughts || '') + event.data.thoughts;
        lastThought.data.sessionEvents = [...(lastThought.data.sessionEvents || []), event];
      } else {
        items.push({
          id: event.eventId,
          type: 'agent-thoughts',
          role: 'agent',
          isStreaming: true,
          data: {
            thoughts: event.data.thoughts,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      composite.isStreaming = true;
      composite.data.sessionEvents!.push(event);
      break;
    }

    case 'model-thought-completed': {
      const composite = findOrCreateAgentMessage(components, event);
      const items = composite.data.items!;
      const lastThoughtIdx = items.findLastIndex(
        (c) => c.type === 'agent-thoughts' && c.isStreaming,
      );
      if (lastThoughtIdx >= 0) {
        const lastThought = touchItem(composite, lastThoughtIdx);
        lastThought.data.thoughts = event.data.thoughts;
        lastThought.isStreaming = false;
        lastThought.data.metadata = event.data.metadata;
        lastThought.data.sessionEvents = [...(lastThought.data.sessionEvents || []), event];
      } else {
        // Hydration: no streaming predecessor
        items.push({
          id: event.eventId,
          type: 'agent-thoughts',
          role: 'agent',
          isStreaming: false,
          data: {
            thoughts: event.data.thoughts,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      composite.data.sessionEvents!.push(event);
      break;
    }

    // ── Message streaming ──────────────────────────────────
    case 'model-message-chunk': {
      const composite = findOrCreateAgentMessage(components, event);
      const items = composite.data.items!;
      const lastMsgIdx = items.findLastIndex(
        (c) => c.type === 'message' && c.isStreaming,
      );
      if (lastMsgIdx >= 0) {
        const lastMsg = touchItem(composite, lastMsgIdx);
        lastMsg.data.message = (lastMsg.data.message || '') + event.data.message;
        lastMsg.data.sessionEvents = [...(lastMsg.data.sessionEvents || []), event];
      } else {
        items.push({
          id: event.eventId,
          type: 'message',
          role: 'agent',
          isStreaming: true,
          data: {
            message: event.data.message,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      composite.isStreaming = true;
      composite.data.sessionEvents!.push(event);
      break;
    }

    case 'model-message-completed': {
      const composite = findOrCreateAgentMessage(components, event);
      const items = composite.data.items!;
      const lastMsgIdx = items.findLastIndex(
        (c) => c.type === 'message' && c.isStreaming,
      );
      if (lastMsgIdx >= 0) {
        const lastMsg = touchItem(composite, lastMsgIdx);
        lastMsg.data.message = event.data.message;
        lastMsg.isStreaming = false;
        lastMsg.data.metadata = event.data.metadata;
        lastMsg.data.sessionEvents = [...(lastMsg.data.sessionEvents || []), event];
      } else {
        items.push({
          id: event.eventId,
          type: 'message',
          role: 'agent',
          isStreaming: false,
          data: {
            message: event.data.message,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      composite.isStreaming = false;
      composite.data.hasResponse = true;
      composite.data.sessionEvents!.push(event);
      break;
    }

    // ── Tool events ────────────────────────────────────────
    case 'tool-call': {
      const composite = findOrCreateAgentMessage(components, event);
      const data = event.data as unknown as AgentSessionComponentData;
      composite.data.items!.push({
        id: event.eventId,
        type: 'tool-call',
        role: 'agent',
        isStreaming: false,
        data: { ...data, agentId: event.agentId, sessionEvents: [event] },
      });
      composite.data.sessionEvents!.push(event);
      break;
    }

    case 'tool-result': {
      const [composite] = touchCompositeWithToolCall(components, event.toolCallEventId);
      if (composite) {
        // touchCompositeWithToolCall already cloned composite + target item
        const target = composite.data.items!.find(
          (c) => c.type === 'tool-call' && c.id === event.toolCallEventId,
        )!;
        target.data.result = event.data.result;
        target.data.metadata = event.data.metadata;
        target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
        composite.data.sessionEvents!.push(event);
      }
      break;
    }

    case 'tool-effects': {
      const [composite] = touchCompositeWithToolCall(components, event.toolCallEventId);
      if (composite) {
        const target = composite.data.items!.find(
          (c) => c.type === 'tool-call' && c.id === event.toolCallEventId,
        )!;
        target.data.toolEffects = event.data.toolEffects;
        target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
        composite.data.sessionEvents!.push(event);
      }
      // Handle embedded sessionComponents from tool-effects
      handleEmbeddedSessionComponents(components, event);
      break;
    }

    // ── User feedback ──────────────────────────────────────
    case 'user-feedback-result': {
      if (isTextFeedback(event.data.result)) {
        // Text feedback → standalone user-feedback component
        const data = event.data as unknown as AgentSessionComponentData;
        components.push({
          id: event.eventId,
          type: 'user-feedback',
          role: 'user',
          isStreaming: false,
          data: { ...data, sessionEvents: [event] },
        });
      } else if (event.toolCallEventId) {
        // Action feedback → merge into tool-call within agent-message
        const [composite] = touchCompositeWithToolCall(components, event.toolCallEventId);
        if (composite) {
          const target = composite.data.items!.find(
            (c) => c.id === event.toolCallEventId,
          )!;
          target.data.result = event.data.result;
          target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
        }
      }
      break;
    }

    // ── Turn completion ────────────────────────────────────
    case 'agent-turn-completed': {
      // Attach final metadata to the last agent-message composite for this agent
      const idx = components.findLastIndex(
        (c) => c.type === 'agent-message' && c.data.agentId === (event.agentId ?? 'none'),
      );
      if (idx >= 0) {
        const composite = touchComposite(components, idx);
        composite.data.metadata = event.data.metadata;
        composite.isStreaming = false;
        composite.data.sessionEvents!.push(event);
      }
      break;
    }

    // ── Branch ─────────────────────────────────────────────
    case 'branch': {
      // Attach to last non-system component
      const idx = components.findLastIndex(c => c.role !== 'system');
      if (idx >= 0) {
        const target = touchComposite(components, idx);
        target.data.sessionEvents!.push(event);
      }
      break;
    }
  }
}

/**
 * Find existing open agent-message composite for this agent,
 * or create a new one.
 *
 * Boundaries that force a new composite:
 * - user-message / user-feedback (turn isolation)
 * - sealed composite (hasResponse === true — response-bounded grouping)
 */
function findOrCreateAgentMessage(
  components: AgentSessionComponent[],
  event: AgentSessionEvent,
): AgentSessionComponent {
  const agentId = event.agentId ?? 'none';

  // Search backwards — stop at user-message boundary (turn isolation)
  for (let i = components.length - 1; i >= 0; i--) {
    const c = components[i]!;
    if (c.type === 'user-message' || c.type === 'user-feedback') break;
    if (c.type === 'agent-message' && c.data.agentId === agentId) {
      // Sealed by a completed response — start a new group
      if (c.data.hasResponse) break;
      // Clone for Zustand/React.memo immutability — new reference
      return touchComposite(components, i);
    }
  }

  // Create new composite — deterministic ID from first event for hydration stability
  const composite: AgentSessionComponent = {
    id: event.eventId,
    role: 'agent',
    type: 'agent-message',
    isStreaming: false,
    data: {
      agentId,
      items: [],
      hasResponse: false,
      sessionEvents: [],
    },
  };
  components.push(composite);
  return composite;
}

// ============================================================
// Flat Mode Derivation
// ============================================================

/**
 * Flat mode maps each meaningful event to its own standalone component —
 * no composites, no grouping. Streaming chunks merge by agentId + type
 * key. Designed for debugging and raw event inspection.
 */
function processEventForFlat(
  components: AgentSessionComponent[],
  event: AgentSessionEvent,
): void {
  switch (event.type) {
    // ── User turn ──────────────────────────────────────────
    case 'user-turn-completed': {
      const data = event.data as unknown as AgentSessionComponentData;
      components.push({
        id: event.eventId,
        type: 'user-message',
        role: 'user',
        isStreaming: false,
        data: { ...data, sessionEvents: [event] },
      });
      break;
    }

    // ── Thought streaming ──────────────────────────────────
    case 'model-thought-chunk': {
      const streamKey = `flat-thoughts-${event.agentId ?? 'none'}`;
      const existing = components.findLast(c => c.id === streamKey && c.isStreaming);
      if (existing) {
        existing.data.thoughts = (existing.data.thoughts || '') + event.data.thoughts;
        existing.data.sessionEvents = [...(existing.data.sessionEvents || []), event];
      } else {
        components.push({
          id: streamKey,
          type: 'agent-thoughts',
          role: 'agent',
          isStreaming: true,
          data: {
            thoughts: event.data.thoughts,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      break;
    }

    case 'model-thought-completed': {
      const streamKey = `flat-thoughts-${event.agentId ?? 'none'}`;
      const existing = components.findLast(c => c.id === streamKey);
      if (existing) {
        existing.data.thoughts = event.data.thoughts;
        existing.isStreaming = false;
        existing.id = event.eventId; // Stabilize ID from streaming key to eventId
        existing.data.metadata = event.data.metadata;
        existing.data.sessionEvents = [...(existing.data.sessionEvents || []), event];
      } else {
        components.push({
          id: event.eventId,
          type: 'agent-thoughts',
          role: 'agent',
          isStreaming: false,
          data: {
            thoughts: event.data.thoughts,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      break;
    }

    // ── Message streaming ──────────────────────────────────
    case 'model-message-chunk': {
      const streamKey = `flat-message-${event.agentId ?? 'none'}`;
      const existing = components.findLast(c => c.id === streamKey && c.isStreaming);
      if (existing) {
        existing.data.message = (existing.data.message || '') + event.data.message;
        existing.data.sessionEvents = [...(existing.data.sessionEvents || []), event];
      } else {
        components.push({
          id: streamKey,
          type: 'message',
          role: 'agent',
          isStreaming: true,
          data: {
            message: event.data.message,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      break;
    }

    case 'model-message-completed': {
      const streamKey = `flat-message-${event.agentId ?? 'none'}`;
      const existing = components.findLast(c => c.id === streamKey);
      if (existing) {
        existing.data.message = event.data.message;
        existing.isStreaming = false;
        existing.id = event.eventId; // Stabilize ID
        existing.data.metadata = event.data.metadata;
        existing.data.sessionEvents = [...(existing.data.sessionEvents || []), event];
      } else {
        components.push({
          id: event.eventId,
          type: 'message',
          role: 'agent',
          isStreaming: false,
          data: {
            message: event.data.message,
            metadata: event.data.metadata,
            agentId: event.agentId,
            sessionEvents: [event],
          },
        });
      }
      break;
    }

    // ── Tool events ────────────────────────────────────────
    case 'tool-call': {
      const data = event.data as unknown as AgentSessionComponentData;
      components.push({
        id: event.eventId,
        type: 'tool-call',
        role: 'agent',
        isStreaming: false,
        data: { ...data, agentId: event.agentId, sessionEvents: [event] },
      });
      break;
    }

    case 'tool-result': {
      // Merge result into matching tool-call by toolCallEventId
      const target = components.findLast(
        c => c.type === 'tool-call' && c.id === event.toolCallEventId,
      );
      if (target) {
        target.data.result = event.data.result;
        target.data.metadata = event.data.metadata;
        target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
      }
      break;
    }

    case 'tool-effects': {
      const target = components.findLast(
        c => c.type === 'tool-call' && c.id === event.toolCallEventId,
      );
      if (target) {
        target.data.toolEffects = event.data.toolEffects;
        target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
      }
      // Embedded sessionComponents
      handleEmbeddedSessionComponents(components, event);
      break;
    }

    // ── User feedback ──────────────────────────────────────
    case 'user-feedback-result': {
      if (isTextFeedback(event.data.result)) {
        const data = event.data as unknown as AgentSessionComponentData;
        components.push({
          id: event.eventId,
          type: 'user-feedback',
          role: 'user',
          isStreaming: false,
          data: { ...data, sessionEvents: [event] },
        });
      } else if (event.toolCallEventId) {
        const target = components.findLast(
          c => c.type === 'tool-call' && c.id === event.toolCallEventId,
        );
        if (target) {
          target.data.result = event.data.result;
          target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
        }
      }
      break;
    }

    // ── Turn completion ────────────────────────────────────
    case 'agent-turn-completed': {
      const last = components.findLast(c => c.role === 'agent');
      if (last) {
        last.data.metadata = event.data.metadata;
        last.data.sessionEvents = [...(last.data.sessionEvents || []), event];
      }
      break;
    }

    // ── Branch ─────────────────────────────────────────────
    case 'branch': {
      const target = components.findLast(c => c.role !== 'system');
      if (target) {
        target.data.sessionEvents = [...(target.data.sessionEvents || []), event];
      }
      break;
    }
  }
}

// ============================================================
// Shared Helpers
// ============================================================

/**
 * Handle embedded sessionComponents from tool-effects.
 * Pushes new components or merges data into existing ones.
 * Hidden components (hideComponent: true) are filtered out.
 */
function handleEmbeddedSessionComponents(
  components: AgentSessionComponent[],
  event: AgentSessionEvent,
): void {
  const toolEffectsData = event.data as { toolEffects?: { sessionComponents?: AgentSessionComponent[] } };
  const embedded = toolEffectsData.toolEffects?.sessionComponents;
  if (!Array.isArray(embedded)) return;

  for (const comp of embedded) {
    if (comp.hideComponent) continue; // Derivation filters hidden components
    const existing = components.find(c => c.id === comp.id);
    if (existing) {
      Object.assign(existing.data, comp.data);
    } else {
      components.push(comp);
    }
  }
}
