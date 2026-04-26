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
import { statusFromEvent, type AgentStatus } from '../utils/agent-status';

/**
 * Sentinel id for the ephemeral staged-message preview synthesized by Insert
 * in the timeline 'developer' compose mode. The component lives inside
 * `sessionComponents` (mirroring the system-panel pattern) so every consumer
 * — interfaces, scroll hooks, click handlers — sees a single coherent list.
 */
const STAGED_PREVIEW_ID = '__staged_user_preview__';

function buildStagedComponent(message: string): AgentSessionComponent {
  return {
    id: STAGED_PREVIEW_ID,
    type: 'user-message',
    role: 'user',
    isStreaming: false,
    data: { message },
  } as unknown as AgentSessionComponent;
}

/**
 * Pure helper: re-inject any active "ambient" components (system panels +
 * staged developer preview) into a freshly-derived `sessionComponents`
 * array. Used by every full-rederivation path (`hydrateFromEvents`,
 * `setUiInterface`).
 */
function injectAmbient(
  components: AgentSessionComponent[],
  activePanels: Map<string, AgentSessionComponentType>,
  stagedUserMessage: string | null,
): AgentSessionComponent[] {
  for (const [panelId, panelType] of activePanels) {
    components.push({
      id: panelId,
      role: 'system',
      type: panelType,
      isStreaming: false,
      data: {},
    });
  }
  // Staged preview always trails (it's a pending compose, conceptually
  // "after" the most recent persisted event).
  if (stagedUserMessage !== null) {
    components.push(buildStagedComponent(stagedUserMessage));
  }
  return components;
}

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
  
  // Timeline workflow composition state
  viewMode: 'developer' as 'developer' | 'client',
  stagedUserMessage: null as string | null,

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
  workflowsPool: [] as import('../types').Workflow[],
  modelsPool: [] as import('../types').ModelSpec[],
  selectedWorkflowId: '' as string,  // hydrated from localStorage in useHydrateStore
  
  // Per-agent runtime status (ephemeral)
  agentStatuses: { none: 'idle' } as Record<string, AgentStatus>,
  scrollToComponentId: null as string | null,
  preserveScrollOnSessionChange: false,
  error: null as string | null,
  submitTrigger: 0,
  
  // Editing
  editingEventId: null as string | null,
  editingData: null as import('../types').EditingData | null,
  
  // Selection (exclusive)
  // REMOVED: selectedComponentId selection feature has been removed

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
  
  setAgentStatus: (agentId: string, status: AgentStatus) => {
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agentId]: status },
    }));
  },

  resetAllAgentStatuses: (status: AgentStatus = 'idle') => {
    set((state) => {
      const next: Record<string, AgentStatus> = {};
      for (const agentId of Object.keys(state.agentStatuses)) next[agentId] = status;
      // Ensure every known agent from the agents[] list is covered
      for (const a of state.agents) if (!(a.agentId in next)) next[a.agentId] = status;
      return { agentStatuses: next };
    });
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

    // Prune active agents that no longer exist in the acquired set
    // (e.g. deleted or released — locally or from another tab).
    // 'none' is the built-in assistant and always retained.
    const active = get().agents;
    const pruned = active.filter(a => a.agentId === 'none' || map[a.agentId]);
    if (pruned.length !== active.length) {
      get().setAgents(pruned);
    }
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
    // Invariant: 'none' (assistant) must always be present
    const hasNone = agents.some(a => a.agentId === 'none');
    if (!hasNone) {
      agents = [createAssistantAgent(), ...agents];
    }
    saveAgents(agents);
    // Reconcile agentStatuses: keep entries for retained agents, default new ones to 'idle'
    set((state) => {
      const nextStatuses: Record<string, AgentStatus> = {};
      for (const a of agents) {
        nextStatuses[a.agentId] = state.agentStatuses[a.agentId] ?? 'idle';
      }
      return { agents, agentStatuses: nextStatuses };
    });
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
    // Reconcile all agents' availableTools against the new pool
    // (drops tools that are no longer available, e.g., disabled via mcp.json)
    const currentAgents = get().agents;
    const reconciled = currentAgents.map(agent => ({
      ...agent,
      config: {
        ...agent.config,
        availableTools: agent.config.availableTools
          .filter(tool => toolsPool.some(t => t.server === tool.server && t.tool === tool.tool))
      }
    }));
    
    // Only update agents if something changed
    if (JSON.stringify(reconciled) !== JSON.stringify(currentAgents)) {
      saveAgents(reconciled);
      set({ agents: reconciled, toolsPool });
    } else {
      set({ toolsPool });
    }
  },

  setWorkflowsPool: (workflowsPool) => {
    set({ workflowsPool });
  },

  setSelectedWorkflowId: (selectedWorkflowId) => {
    set({ selectedWorkflowId });
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

      // Pull the staged preview out, run event processing on the
      // event-derived list, then re-append the staged preview at the tail.
      // Keeps the staged bubble visually "after" the latest persisted event
      // even when chunks stream in mid-compose (rare in practice — the user
      // would have to Insert before any event lands — but cheap to maintain).
      const stagedIdx = state.sessionComponents.findIndex(c => c.id === STAGED_PREVIEW_ID);
      const staged = stagedIdx >= 0 ? state.sessionComponents[stagedIdx] : null;
      const sessionComponents = staged
        ? state.sessionComponents.filter(c => c.id !== STAGED_PREVIEW_ID)
        : [...state.sessionComponents];
      processEventIntoComponents(sessionComponents, event, state.uiInterface);
      if (staged) sessionComponents.push(staged);

      const agentStatuses = { ...state.agentStatuses };
      let activeFeedbackRequest = state.activeFeedbackRequest;

      // user-turn-completed is session-scoped: mark every known agent as 'processing'
      // so each one lights up while waiting for its first model event.
      if (event.type === 'user-turn-completed') {
        for (const a of state.agents) agentStatuses[a.agentId] = 'processing';
      } else {
        const agentKey = event.agentId || 'none';

        // Tool-effects with pending userActions → that agent is waiting for feedback
        if (event.type === 'tool-effects') {
          const { toolEffects } = event.data as ToolEffectsData;
          if (toolEffects?.userActions) {
            activeFeedbackRequest = {
              toolCallEventId: event.toolCallEventId!,
              userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
            };
            agentStatuses[agentKey] = 'waitingFeedback';
          } else {
            const mapped = statusFromEvent(event);
            if (mapped) agentStatuses[agentKey] = mapped;
          }
        } else {
          const mapped = statusFromEvent(event);
          if (mapped) agentStatuses[agentKey] = mapped;
        }
      }

      return {
        agentSessionEvents,
        sessionComponents,
        agentStatuses,
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
    const { activePanels, uiInterface, stagedUserMessage } = get();
    const sessionComponents = injectAmbient(
      toAgentSessionComponents(events, uiInterface),
      activePanels,
      stagedUserMessage,
    );
    set({ agentSessionEvents: events, sessionComponents });
  },

  clearEvents: () => set({
    agentSessionEvents: [],
    sessionComponents: [],
    activePanels: new Map(),
    // A fresh session has no pending compose — the staged preview is tied
    // to the just-cleared session context.
    stagedUserMessage: null,
  }),

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
    const { agentSessionEvents, activePanels, stagedUserMessage } = get();
    const sessionComponents = injectAmbient(
      toAgentSessionComponents(agentSessionEvents, uiInterface),
      activePanels,
      stagedUserMessage,
    );
    set({ uiInterface, sessionComponents });
  },

  setPersistAgentSession: (persistAgentSession) => {
    set({ persistAgentSession });
  },

  setEphemeral: (ephemeral) => {
    set({ ephemeral });
  },
  
  // View mode actions (timeline workflow)
  setViewMode: (mode) => {
    set({ viewMode: mode });
    // Switching away from 'developer' compose mode invalidates any staged
    // developer-text bubble (the Insert button is hidden in client mode,
    // so the user could no longer reach the staged content). Delegate to
    // setStagedUserMessage so the synthetic component is removed from
    // sessionComponents in the same swing.
    if (mode !== 'developer') {
      get().setStagedUserMessage(null);
    }
  },
  setStagedUserMessage: (message) => {
    set((state) => {
      // Always strip any pre-existing staged component first — idempotent
      // for both insert (replace text) and clear paths.
      const sessionComponents = state.sessionComponents.filter(c => c.id !== STAGED_PREVIEW_ID);
      if (message !== null) {
        sessionComponents.push(buildStagedComponent(message));
      }
      return { stagedUserMessage: message, sessionComponents };
    });
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
      agentStatuses: { none: 'idle' },
    });
  },
}));

// Export AgentSessionComponent type for convenience
export type { AgentSessionComponent } from '../types';
