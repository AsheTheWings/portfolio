/**
 * toSessionComponent.ts - Pure stateless event → component mapper
 * 
 * Minimal transformation: event.data flows through to component.data
 * Store's upsertComponent handles merge logic (append strings, coexist keys)
 */

import type { AgentSessionEvent, AgentSessionComponent, AgentSessionComponentType, AgentSessionComponentControls } from '../types';

/**
 * Event type → Component type mapping
 */
const EVENT_TO_COMPONENT_TYPE: Partial<Record<AgentSessionEvent['type'], AgentSessionComponentType>> = {
  'user-turn-completed': 'message',
  'model-message-chunk': 'message',
  'model-message-completed': 'message',
  'model-thought-chunk': 'agent-thoughts',
  'model-thought-completed': 'agent-thoughts',
  'agent-turn-completed': 'message',  // Metadata update for last message
  'tool-call': 'tool-call',
  'tool-result': 'tool-call',
  'tool-effects': 'tool-call',
  'user-feedback-result': 'tool-call',  // Default to tool-call, text feedback overrides to 'user-feedback'
  'branch': 'message',  // Branch info attached to message
};

/**
 * Get controls for an event type
 * - isBackground: no controls (background components don't show buttons)
 * - Chunks: no controls (still streaming)
 * - Metadata updates (agent-turn-completed, branch): undefined to preserve existing
 * - model-thought-completed: debug only
 * - Message events: full controls + translate
 * - Everything else: full controls (edit, revert, branch, debug)
 */
function getControls(eventType: AgentSessionEvent['type'], isBackground?: boolean): AgentSessionComponentControls | undefined {
  if (isBackground) return undefined;
  if (eventType.includes('-chunk')) return undefined;
  
  // Metadata update events: preserve existing controls
  if (eventType === 'agent-turn-completed' || eventType === 'branch') return undefined;
  
  if (eventType === 'model-thought-completed') return { debug: true };
  
  // Message events get translate control
  if (eventType === 'user-turn-completed' || eventType === 'model-message-completed') {
    return { edit: true, revert: true, branch: true, debug: true, translate: true };
  }
  
  return { edit: true, revert: true, branch: true, debug: true };
}

/**
 * Get component role from event
 */
function getRole(event: AgentSessionEvent): 'user' | 'agent' | 'system' {
  if (event.role) return event.role;
  if (event.type.startsWith('user')) return 'user';
  return 'agent';
}

/**
 * Convert a AgentSessionEvent to AgentSessionComponents
 * 
 * Returns array of components:
 * - tool-effects: returns embedded sessionComponents with turnMetadata enriched from event metadata
 * - Other events: single component with event.data spread + sessionEvents
 * 
 * @param event - The session event to convert
 * @returns Array of AgentSessionComponents (empty if event doesn't map)
 */
export function toAgentSessionComponents(event: AgentSessionEvent): AgentSessionComponent[] {
  // Collect additional components from tool-effects sessionComponents
  let additionalComponents: AgentSessionComponent[] = [];
  
  if (event.type === 'tool-effects') {
    const effectComponents = (event.data as { toolEffects?: { sessionComponents?: AgentSessionComponent[]; metadata?: unknown } })?.toolEffects?.sessionComponents;
    if (Array.isArray(effectComponents)) {
      // Enrich each component with turnMetadata from event metadata
      additionalComponents = effectComponents.map((comp: AgentSessionComponent) => ({
        ...comp,
        data: {
          ...comp.data,
          turnMetadata: (event.data as { toolEffects?: { metadata?: unknown } })?.toolEffects?.metadata,
        },
      }));
    }
  }
  
  // Get component type from mapping
  let componentType = EVENT_TO_COMPONENT_TYPE[event.type];
  if (!componentType) return additionalComponents;
  
  // user-feedback-result: text feedback → 'user-feedback' type, action feedback → 'tool-call' type
  let componentId = event.componentId;
  if (event.type === 'user-feedback-result') {
    const result = (event.data as { result?: { userFeedback?: string } }).result;
    const hasTextFeedback = result?.userFeedback && 
      typeof result.userFeedback === 'string' && 
      result.userFeedback.trim();
    if (hasTextFeedback) {
      componentType = 'user-feedback';
      componentId = event.eventId;  // Unique id for text feedback component
    }
    // else: use 'tool-call' type with componentId (links to tool-call)
  }
  
  // Unified mapping: spread event.data + add sessionEvents
  const isBackground = (event.data as { isBackground?: boolean }).isBackground;
  const isStreaming = event.type.includes('-chunk');
  
  // Main component for this event
  const mainComponent: AgentSessionComponent = {
    id: componentId,
    role: getRole(event),
    type: componentType,
    isStreaming,
    controls: getControls(event.type, isBackground),
    hideComponent: !!isBackground && componentType !== 'message',
    data: {
      ...event.data,
      sessionEvents: [event],
    },
  };
  
  return [mainComponent, ...additionalComponents];
}
