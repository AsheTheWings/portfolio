'use client';

/**
 * Agent Store - Zustand state management for agent domain
 * Pure UI state container — session lifecycle managed by WS + REST hooks
 */

import { create } from 'zustand';
import type {
  AgentState,
  AgentSessionComponent,
  AgentSessionEvent,
} from '../types';
import { createDefaultAgentConfig, getModelSpec, hasCapability } from '../services/models-registry';
import { ModelCapability } from '../types';
import { saveAgentConfig } from '../utils/agent-storage';
import { toAgentSessionComponents } from '../utils/toAgentSessionComponent';

/**
 * Merge an incoming component into an existing one.
 * - Streaming chunks: append message/thoughts text
 * - Completed events: replace message/thoughts text
 * - sessionEvents: deduplicate by eventId, append new
 * - role: preserve non-system role if incoming is system
 * - hideComponent: once hidden, stays hidden
 * - controls: incoming wins, fall back to existing
 */
function mergeComponent(
  existing: AgentSessionComponent,
  incoming: AgentSessionComponent,
): AgentSessionComponent {
  const mergedMessage = (() => {
    if (incoming.data.message === undefined) return existing.data.message;
    if (existing.data.message === undefined) return incoming.data.message;
    if (!incoming.isStreaming) return incoming.data.message;
    return existing.data.message + incoming.data.message;
  })();

  const mergedThoughts = (() => {
    if (incoming.data.thoughts === undefined) return existing.data.thoughts;
    if (existing.data.thoughts === undefined) return incoming.data.thoughts;
    if (!incoming.isStreaming) return incoming.data.thoughts;
    return existing.data.thoughts + incoming.data.thoughts;
  })();

  const mergedSessionEvents = (() => {
    if (!existing.data.sessionEvents && !incoming.data.sessionEvents) return undefined;
    if (!existing.data.sessionEvents) return incoming.data.sessionEvents;
    if (!incoming.data.sessionEvents) return existing.data.sessionEvents;
    const existingIds = new Set(existing.data.sessionEvents.map((e: { eventId: string }) => e.eventId));
    const newEvents = incoming.data.sessionEvents.filter((e: { eventId: string }) => !existingIds.has(e.eventId));
    return [...existing.data.sessionEvents, ...newEvents];
  })();

  return {
    ...existing,
    ...incoming,
    type: existing.type,  // First event establishes type; merges must not overwrite
    role: (incoming.role === 'system' && existing.role !== 'system')
      ? existing.role
      : incoming.role,
    isStreaming: incoming.isStreaming,
    hideComponent: existing.hideComponent ?? incoming.hideComponent,
    controls: incoming.controls ?? existing.controls,
    data: {
      ...existing.data,
      ...incoming.data,
      message: mergedMessage,
      thoughts: mergedThoughts,
      sessionEvents: mergedSessionEvents,
    },
  };
}

const initialState = {
  currentSessionId: null as string | null,
  agentConfig: createDefaultAgentConfig(),
  
  // Hydration state
  _hydrated: false,
  
  // Initial config panel shown (prevents re-showing on route changes)
  _hasShownInitialConfig: false,
  
  // UI
  uiMode: 'chat' as const,
  sessionComponents: [] as AgentSessionComponent[],
  persistAgentSession: true,
  ephemeral: false,
  userMessagesHistory: [] as string[],
  
  // Tools
  toolsPool: [] as import('../types').Tool[],
  workflowsPool: [] as import('../types').WorkflowSpec[],
  
  // State
  conversationStatus: 'healthy' as AgentState['conversationStatus'],
  scrollToComponentId: null as string | null,
  preserveScrollOnSessionChange: false,
  error: null as string | null,
  submitTrigger: 0,
  
  // Editing
  editingComponentId: null as string | null,
  editingData: null as import('../types').EditingData | null,
  
  // Branching
  showingBranchesForComponent: null as string | null,
  
  // Feedback mode
  activeFeedbackRequest: null as AgentState['activeFeedbackRequest'],
  
  // Job UI state
  selectedJobId: null as string | null,
  activeJob: null as { jobId: string; title: string } | null,
  
  // Translation state
  preferredTranslationLanguage: null as string | null,
  translationCache: {} as Record<string, Record<string, string>>,
  activeTranslations: {} as Record<string, string | null>,
  translatingComponents: new Set<string>(),
  
  // Pending library items (asset or folder IDs) for message attachment
  pendingLibraryItemIds: [] as string[],
};

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,
  
  setConversationStatus: (conversationStatus: AgentState['conversationStatus']) => {
    set({ conversationStatus });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  setScrollToComponentId: (componentId: string | null) => {
    set({ scrollToComponentId: componentId });
  },

  clearScrollToComponentId: () => {
    set({ scrollToComponentId: null });
  },

  setPreserveScrollOnSessionChange: (preserve: boolean) => {
    set({ preserveScrollOnSessionChange: preserve });
  },

  triggerSubmit: () => {
    set((state) => ({ submitTrigger: state.submitTrigger + 1 }));
  },

  // Session management
  setCurrentAgentSessionId: (currentSessionId) => {
    set({ currentSessionId });
  },

  setAgentConfig: (agentConfig) => {
    if (!agentConfig) {
      set({ agentConfig: null });
      return;
    }

    // Enforce business rules to maintain config invariants
    const finalConfig = { ...agentConfig };
    const currentConfig = get().agentConfig;
    const toolsPool = get().toolsPool;
    
    // Rule 1: If model doesn't support thinking, disable enableThinking
    const supportsThinking = hasCapability(finalConfig.model, ModelCapability.THINKING);
    if (!supportsThinking) {
      finalConfig.enableThinking = false;
    }
    
    // Rule 2: includeThoughtsInResponse requires enableThinking
    if (!finalConfig.enableThinking) {
      finalConfig.includeThoughtsInResponse = false;
      finalConfig.includeThoughtsInContext = false;
    }
    
    // Rule 3: Can't combine MCP tools with native tools
    if (finalConfig.enableTools) {
      finalConfig.selectedNativeTools = [];
    }
    
    // Rule 4: Auto-populate availableTools when enabling tools
    if (finalConfig.enableTools && !currentConfig?.enableTools) {
      finalConfig.availableTools = toolsPool;
    } else if (!finalConfig.enableTools) {
      finalConfig.availableTools = [];
    }
    
    // Persist to localStorage
    saveAgentConfig(finalConfig);
    
    set({ agentConfig: finalConfig });
  },

  // Tool management
  setToolsPool: (toolsPool) => {
    set({ toolsPool });
  },

  setWorkflowsPool: (workflowsPool) => {
    set({ workflowsPool });
  },

  // UI component actions
  setAgentSessionComponents: (components) =>
    set((state) => ({
      sessionComponents: typeof components === 'function' ? components(state.sessionComponents) : components,
    })),

  upsertComponent: (input) =>
    set((state) => {
      const components = Array.isArray(input) ? input : [input];
      let updated = [...state.sessionComponents];
      
      for (const component of components) {
        const existingIndex = updated.findIndex((comp) => comp.id === component.id);
        
        if (existingIndex >= 0) {
          updated[existingIndex] = mergeComponent(updated[existingIndex], component);
        } else {
          updated = [...updated, component];
        }
      }
      
      return { sessionComponents: updated };
    }),

  upsertComponentFromEvent: (event: AgentSessionEvent) => {
    const components = toAgentSessionComponents(event);
    if (components.length > 0) {
      get().upsertComponent(components);
    }
  },

  hydrateFromEvents: (events: AgentSessionEvent[]) => {
    // Clear existing components and rebuild from events
    const allComponents: AgentSessionComponent[] = [];
    for (const event of events) {
      const mapped = toAgentSessionComponents(event);
      for (const component of mapped) {
        const existingIndex = allComponents.findIndex((c) => c.id === component.id);
        if (existingIndex >= 0) {
          allComponents[existingIndex] = mergeComponent(allComponents[existingIndex], component);
        } else {
          allComponents.push(component);
        }
      }
    }
    set({ sessionComponents: allComponents });
  },

  clearComponents: () => set({ sessionComponents: [] }),

  markInitialConfigShown: () => set({ _hasShownInitialConfig: true }),

  removeComponent: (id) =>
    set((state) => ({
      sessionComponents: state.sessionComponents.filter((comp) => comp.id !== id),
    })),

  removeComponentsByType: (type) =>
    set((state) => ({
      sessionComponents: state.sessionComponents.filter((comp) => comp.type !== type),
    })),

  removeComponentsByRole: (role) =>
    set((state) => ({
      sessionComponents: state.sessionComponents.filter((comp) => comp.role !== role),
    })),

  // Control actions
  setUiMode: (uiMode) => {
    set({ uiMode });
  },

  setPersistAgentSession: (persistAgentSession) => {
    set({ persistAgentSession });
  },

  setEphemeral: (ephemeral) => {
    set({ ephemeral });
  },
  
  // User messages history actions
  setUserMessagesHistory: (history) => {
    set({ userMessagesHistory: history.slice(0, 20) });
  },
  
  appendToUserMessagesHistory: (message) => {
    set((state) => {
      const updated = [message, ...state.userMessagesHistory].slice(0, 20);
      return { userMessagesHistory: updated };
    });
  },
  
  clearUserMessagesHistory: () => {
    set({ userMessagesHistory: [] });
  },
  
  // Editing actions
  startEdit: (componentId, initialData) => {
    const editingData = typeof initialData === 'string'
      ? { message: initialData }
      : initialData;
    
    set({
      editingComponentId: componentId,
      editingData,
    });
  },

  updateEditingData: (data) => {
    set((state) => ({
      editingData: state.editingData ? { ...state.editingData, ...data } : data,
    }));
  },

  cancelEdit: () => {
    set({
      editingComponentId: null,
      editingData: null,
    });
  },

  // Branch UI state actions
  showBranches: (componentId) => {
    set({ showingBranchesForComponent: componentId });
  },

  hideBranches: () => {
    set({ showingBranchesForComponent: null });
  },

  // Scroll actions
  scrollToComponent: (componentId: string) => {
    set({ scrollToComponentId: componentId });
  },

  // Feedback mode actions
  setActiveFeedbackRequest: (request) => {
    set({ activeFeedbackRequest: request });
  },

  clearActiveFeedbackRequest: () => {
    set({ activeFeedbackRequest: null });
  },

  // Background job UI actions
  selectJob: (jobId: string | null) => {
    set({ selectedJobId: jobId });
  },

  setActiveJob: (job: { jobId: string; title: string } | null) => {
    set({ activeJob: job });
  },

  getLastComponentByJob: () => {
    const map: Record<string, string> = {};
    for (const c of get().sessionComponents) {
      if (c.data.jobId && !c.hideComponent) {
        map[c.data.jobId] = c.id;
      }
    }
    return map;
  },

  // Translation actions
  setPreferredTranslationLanguage: (language: string | null) => {
    set({ preferredTranslationLanguage: language });
  },

  cacheTranslation: (componentId: string, language: string, text: string) => {
    set((state) => ({
      translationCache: {
        ...state.translationCache,
        [componentId]: {
          ...state.translationCache[componentId],
          [language]: text,
        },
      },
    }));
  },

  setActiveTranslation: (componentId: string, language: string | null) => {
    set((state) => ({
      activeTranslations: {
        ...state.activeTranslations,
        [componentId]: language,
      },
    }));
  },

  resetAllTranslations: () => {
    set({ activeTranslations: {} });
  },

  setComponentTranslating: (componentId: string, translating: boolean) => {
    set((state) => {
      const next = new Set(state.translatingComponents);
      if (translating) next.add(componentId);
      else next.delete(componentId);
      return { translatingComponents: next };
    });
  },

  // Pending library items actions
  addPendingLibraryItems: (ids: string[]) => {
    set((state) => {
      const existingIds = new Set(state.pendingLibraryItemIds);
      const newIds = ids.filter(id => !existingIds.has(id));
      return {
        pendingLibraryItemIds: [...state.pendingLibraryItemIds, ...newIds].slice(0, 100),
      };
    });
  },

  removePendingLibraryItem: (id: string) => {
    set((state) => ({
      pendingLibraryItemIds: state.pendingLibraryItemIds.filter(itemId => itemId !== id),
    }));
  },

  clearPendingLibraryItems: () => {
    set({ pendingLibraryItemIds: [] });
  },

  // Store reset
  reset: () => {
    set({
      ...initialState,
      conversationStatus: 'healthy',
    });
  },
}));

// Export AgentSessionComponent type for convenience
export type { AgentSessionComponent } from '../types';
