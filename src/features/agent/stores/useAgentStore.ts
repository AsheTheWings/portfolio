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
  
  // State
  conversationStatus: 'healthy' as AgentState['conversationStatus'],
  scrollToComponentId: null as string | null,
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
          // Update existing component with smart merge
          const existing = updated[existingIndex];
          
          // Append-merge for message (string concatenation for streaming)
          // Only append if incoming is a chunk (isStreaming=true), otherwise replace
          const mergedMessage = (() => {
            if (component.data.message === undefined) return existing.data.message;
            if (existing.data.message === undefined) return component.data.message;
            if (!component.isStreaming) return component.data.message;
            return existing.data.message + component.data.message;
          })();
          
          // Append-merge for thoughts (string concatenation for streaming)
          const mergedThoughts = (() => {
            if (component.data.thoughts === undefined) return existing.data.thoughts;
            if (existing.data.thoughts === undefined) return component.data.thoughts;
            if (!component.isStreaming) return component.data.thoughts;
            return existing.data.thoughts + component.data.thoughts;
          })();
          
          // Append-merge for sessionEvents (deduplicate by eventId)
          const mergedSessionEvents = (() => {
            if (!existing.data.sessionEvents && !component.data.sessionEvents) return undefined;
            if (!existing.data.sessionEvents) return component.data.sessionEvents;
            if (!component.data.sessionEvents) return existing.data.sessionEvents;
            const existingIds = new Set(existing.data.sessionEvents.map((e: { eventId: string }) => e.eventId));
            const newEvents = component.data.sessionEvents.filter((e: { eventId: string }) => !existingIds.has(e.eventId));
            return [...existing.data.sessionEvents, ...newEvents];
          })();
          
          updated[existingIndex] = {
            ...existing,
            ...component,
            role: (component.role === 'system' && existing.role !== 'system') 
              ? existing.role 
              : component.role,
            isStreaming: component.isStreaming,
            hideComponent: existing.hideComponent ?? component.hideComponent,
            controls: component.controls ?? existing.controls,
            data: {
              ...existing.data,
              ...component.data,
              message: mergedMessage,
              thoughts: mergedThoughts,
              sessionEvents: mergedSessionEvents,
            },
          };
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
          // Merge (same logic as upsertComponent but in-memory)
          const existing = allComponents[existingIndex];
          const mergedMessage = component.data.message !== undefined
            ? (existing.data.message !== undefined && component.isStreaming
                ? existing.data.message + component.data.message
                : component.data.message)
            : existing.data.message;
          const mergedThoughts = component.data.thoughts !== undefined
            ? (existing.data.thoughts !== undefined && component.isStreaming
                ? existing.data.thoughts + component.data.thoughts
                : component.data.thoughts)
            : existing.data.thoughts;
          const mergedSessionEvents = (() => {
            if (!existing.data.sessionEvents && !component.data.sessionEvents) return undefined;
            if (!existing.data.sessionEvents) return component.data.sessionEvents;
            if (!component.data.sessionEvents) return existing.data.sessionEvents;
            const ids = new Set(existing.data.sessionEvents.map((e: { eventId: string }) => e.eventId));
            return [...existing.data.sessionEvents, ...component.data.sessionEvents.filter((e: { eventId: string }) => !ids.has(e.eventId))];
          })();
          allComponents[existingIndex] = {
            ...existing,
            ...component,
            role: (component.role === 'system' && existing.role !== 'system') ? existing.role : component.role,
            isStreaming: component.isStreaming,
            hideComponent: existing.hideComponent ?? component.hideComponent,
            controls: component.controls ?? existing.controls,
            data: { ...existing.data, ...component.data, message: mergedMessage, thoughts: mergedThoughts, sessionEvents: mergedSessionEvents },
          };
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
