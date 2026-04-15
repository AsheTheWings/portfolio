'use client';

/**
 * Agent Store - Zustand state management for agent domain
 * Pure UI state container — session lifecycle managed by WS + REST hooks
 */

import { create } from 'zustand';
import type {
  AgentState,
  AgentSessionComponent,
  AgentSessionComponentType,
  AgentSessionEvent,
  Agent,
  AgentConfig,
  SavedAgent,
  UIInterface,
  ToolEffectsData,
} from '../types';
import { createDefaultAgentConfig, hasCapability, createAssistantAgent, syncModelsRegistry } from '../services/models-registry';
import { ModelCapability } from '../types';
import { saveAgents } from '../utils/agent-storage';
import { toAgentSessionComponents, processEventIntoComponents } from '../utils/toAgentSessionComponent';

/**
 * Enforce business rules on agent config to maintain invariants.
 * Extracted from setAgentConfig for reuse by multi-agent actions.
 */
function enforceConfigInvariants(
  config: AgentConfig, 
  currentConfig: AgentConfig | null, 
  toolsPool: import('../types').Tool[]
): AgentConfig {
  const finalConfig = { ...config };
  
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
  
  return finalConfig;
}

const initialState = {
  currentSessionId: null as string | null,
  agents: [createAssistantAgent()] as Agent[],
  
  // Acquired agents library
  acquiredAgents: {} as Record<string, SavedAgent>,
  
  // Hydration state
  _hydrated: false,
  
  // Initial config panel shown (prevents re-showing on route changes)
  _hasShownInitialConfig: false,
  
  // UI
  uiInterface: 'chat' as UIInterface,
  sessionComponents: [] as AgentSessionComponent[],
  agentSessionEvents: [] as AgentSessionEvent[],
  activePanels: new Map<string, AgentSessionComponentType>(),
  persistAgentSession: true,
  ephemeral: false,
  userMessagesHistory: [] as string[],
  
  // Tools
  toolsPool: [] as import('../types').Tool[],
  workflowsPool: [] as import('../types').WorkflowSpec[],
  modelsPool: [] as import('../types').ModelSpec[],
  
  // State
  conversationStatus: 'healthy' as AgentState['conversationStatus'],
  scrollToComponentId: null as string | null,
  preserveScrollOnSessionChange: false,
  error: null as string | null,
  submitTrigger: 0,
  
  // Editing
  editingEventId: null as string | null,
  editingData: null as import('../types').EditingData | null,
  
  // Selection (exclusive)
  selectedComponentId: null as string | null,

  // Branching
  showingBranchesForComponent: null as string | null,
  
  // Feedback mode
  activeFeedbackRequest: null as AgentState['activeFeedbackRequest'],
  
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

  // Acquired agents management
  setAcquiredAgents: (agents: SavedAgent[]) => {
    const map: Record<string, SavedAgent> = {};
    for (const agent of agents) {
      map[agent.id] = agent;
    }
    set({ acquiredAgents: map });
  },

  getAcquiredAgent: (id: string) => {
    return get().acquiredAgents[id];
  },

  // Multi-agent management
  setAgents: (incoming: Agent[]) => {
    // Deduplicate by agentId (keep first occurrence)
    const seen = new Set<string>();
    let agents = incoming.filter(a => {
      if (seen.has(a.agentId)) return false;
      seen.add(a.agentId);
      return true;
    });
    if (agents.length !== incoming.length) {
    }
    // Invariant: 'none' (assistant) must always be present
    const hasNone = agents.some(a => a.agentId === 'none');
    if (!hasNone) {
      agents = [createAssistantAgent(), ...agents];
    }
    saveAgents(agents);
    set({ agents });
  },

  addAgent: (agentId: string, config: AgentConfig) => {
    const currentAgents = get().agents;
    if (currentAgents.some(a => a.agentId === agentId)) return;
    get().setAgents([...currentAgents, { agentId, config }]);
  },

  removeAgent: (agentId: string) => {
    if (agentId === 'none') return; // Cannot remove assistant
    const currentAgents = get().agents;
    get().setAgents(currentAgents.filter(a => a.agentId !== agentId));
  },

  toggleAgent: (agentId: string, config: AgentConfig) => {
    const currentAgents = get().agents;
    const isPresent = currentAgents.some(a => a.agentId === agentId);
    if (isPresent) {
      get().removeAgent(agentId);
    } else {
      get().addAgent(agentId, config);
    }
  },

  updateFrontAgentConfig: (configOrUpdater) => {
    const currentAgents = get().agents;
    if (currentAgents.length === 0) return;
    
    const currentConfig = currentAgents[0].config;
    const rawConfig = typeof configOrUpdater === 'function'
      ? configOrUpdater(currentConfig)
      : configOrUpdater;
    
    // Enforce business rules
    const finalConfig = enforceConfigInvariants(rawConfig, currentConfig, get().toolsPool);
    
    const updated = [...currentAgents];
    updated[0] = { ...updated[0], config: finalConfig };
    saveAgents(updated);
    set({ agents: updated });
  },

  setFrontAgent: (agentId: string) => {
    const currentAgents = get().agents;
    const idx = currentAgents.findIndex(a => a.agentId === agentId);
    if (idx <= 0) return; // Already front or not found
    const updated = [...currentAgents];
    const [agent] = updated.splice(idx, 1);
    updated.unshift(agent);
    saveAgents(updated);
    set({ agents: updated });
  },

  /** @deprecated Compat shim — updates agents[0].config */
  setAgentConfig: (agentConfigOrUpdater) => {
    const currentAgents = get().agents;
    const currentConfig = currentAgents[0]?.config ?? createDefaultAgentConfig();
    
    const agentConfig = typeof agentConfigOrUpdater === 'function'
      ? agentConfigOrUpdater(currentConfig)
      : agentConfigOrUpdater;

    if (!agentConfig) return;

    const finalConfig = enforceConfigInvariants(agentConfig, currentConfig, get().toolsPool);
    
    const updated = currentAgents.length > 0
      ? [{ ...currentAgents[0], config: finalConfig }, ...currentAgents.slice(1)]
      : [{ agentId: 'none', config: finalConfig }];
    
    saveAgents(updated);
    set({ agents: updated });
  },

  // Tool management
  setToolsPool: (toolsPool) => {
    set({ toolsPool });
  },

  setWorkflowsPool: (workflowsPool) => {
    set({ workflowsPool });
  },

  setModelsPool: (modelsPool) => {
    syncModelsRegistry(modelsPool);
    set({ modelsPool });
  },

  // UI component actions
  setAgentSessionComponents: (components) =>
    set((state) => ({
      sessionComponents: typeof components === 'function' ? components(state.sessionComponents) : components,
    })),

  appendEvent: (event: AgentSessionEvent) => {
    set((state) => {
      const agentSessionEvents = [...state.agentSessionEvents, event];
      const sessionComponents = [...state.sessionComponents];
      processEventIntoComponents(sessionComponents, event, state.uiInterface);

      let conversationStatus = state.conversationStatus;
      let activeFeedbackRequest = state.activeFeedbackRequest;
      let skipStatusDerivation = false;

      // Tool-effects side effects (config updates handled after set)
      if (event.type === 'tool-effects') {
        const { toolEffects } = event.data as ToolEffectsData;
        if (toolEffects && Object.keys(toolEffects).length > 0) {
          if (toolEffects.userActions) {
            activeFeedbackRequest = {
              toolCallEventId: event.toolCallEventId!,
              userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
            };
            conversationStatus = 'waitingFeedback';
            skipStatusDerivation = true;
          }
        }
      }

      // Derive conversation status from event type
      if (!skipStatusDerivation) {
        switch (event.type) {
          case 'model-thought-chunk': conversationStatus = 'thinking'; break;
          case 'model-message-chunk': conversationStatus = 'responding'; break;
          case 'tool-call': conversationStatus = 'toolCalling'; break;
          case 'agent-turn-completed': conversationStatus = 'healthy'; break;
          case 'user-turn-completed': conversationStatus = 'processing'; break;
        }
      }

      return {
        agentSessionEvents,
        sessionComponents,
        conversationStatus,
        activeFeedbackRequest,
      };
    });

    // Handle config update outside of set (calls another store method)
    if (event.type === 'tool-effects') {
      const { toolEffects } = event.data as ToolEffectsData;
      if (toolEffects?.updateConfig) {
        get().updateFrontAgentConfig(prev => ({
          ...prev,
          ...toolEffects.updateConfig!,
        }));
      }
    }
  },

  hydrateFromEvents: (events: AgentSessionEvent[]) => {
    const { activePanels, uiInterface } = get();
    const sessionComponents = toAgentSessionComponents(events, uiInterface);
    // Re-inject active system panels
    for (const [panelId, panelType] of activePanels) {
      sessionComponents.push({
        id: panelId,
        role: 'system',
        type: panelType,
        isStreaming: false,
        data: {},
      });
    }
    set({ agentSessionEvents: events, sessionComponents });
  },

  clearEvents: () => set({ agentSessionEvents: [], sessionComponents: [], activePanels: new Map() }),

  clearSystemPanels: () =>
    set((state) => ({
      sessionComponents: state.sessionComponents.filter(c => c.role !== 'system'),
      activePanels: new Map(),
    })),

  markInitialConfigShown: () => set({ _hasShownInitialConfig: true }),

  removeComponent: (id) =>
    set((state) => {
      const activePanels = new Map(state.activePanels);
      activePanels.delete(id);
      return {
        sessionComponents: state.sessionComponents.filter((comp) => comp.id !== id),
        activePanels,
      };
    }),

  upsertSystemPanel: (panelId: string, panelType: AgentSessionComponentType) =>
    set((state) => {
      const activePanels = new Map(state.activePanels);
      activePanels.set(panelId, panelType);
      const sessionComponents = state.sessionComponents.filter(c => c.id !== panelId);
      sessionComponents.push({
        id: panelId,
        role: 'system',
        type: panelType,
        isStreaming: false,
        data: {},
      });
      return { sessionComponents, activePanels };
    }),

  removeSystemPanel: (panelId: string) =>
    set((state) => {
      const activePanels = new Map(state.activePanels);
      activePanels.delete(panelId);
      return {
        sessionComponents: state.sessionComponents.filter(c => c.id !== panelId),
        activePanels,
      };
    }),

  // Control actions
  setUiInterface: (uiInterface: UIInterface) => {
    const { agentSessionEvents, activePanels } = get();
    const sessionComponents = toAgentSessionComponents(agentSessionEvents, uiInterface);
    for (const [panelId, panelType] of activePanels) {
      sessionComponents.push({
        id: panelId,
        role: 'system',
        type: panelType,
        isStreaming: false,
        data: {},
      });
    }
    set({ uiInterface, sessionComponents });
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
  startEdit: (eventId, initialData) => {
    const editingData = typeof initialData === 'string'
      ? { message: initialData }
      : initialData;
    
    set({
      editingEventId: eventId,
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
      editingEventId: null,
      editingData: null,
    });
  },

  // Selection actions
  selectComponent: (componentId) => {
    set({ selectedComponentId: componentId });
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
