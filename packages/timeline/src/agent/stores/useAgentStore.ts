'use client';

/**
 * Agent Store - Zustand state management for agent domain
 * Pure UI state container — session lifecycle managed by WS + REST hooks
 */

import { create, useStore, type StoreApi } from 'zustand';
import { createStore } from 'zustand';
import React, { createContext, useContext, useRef } from 'react';
import type {
  AgentState,
  SessionComponent,
  SessionComponentType,
  SessionEvent,
  Agent,
  AgentConfig,
  UIInterface,
  ToolEffectsData,
} from '../types/session';
import type { SavedAgent } from '@agentime/protocol';
import { createDefaultAgentConfig, createAssistantAgent } from '../utils/agent-factory';
import { saveAgents } from '../utils/agent-storage';
import { toSessionComponents, processEventIntoComponents } from '../utils/toSessionComponent';
import {
  agentStatusFromEvent,
  applyAgentStatusesForLifecycleEvent,
  deriveWorkflowStatus,
  workflowStatusFromEvent,
  type AgentStatus,
  type WorkflowStatus,
} from '../utils/status';
import type { LlmRegistrySnapshot, ModelParameterDefinition, ModelSpec } from '../types/llm';

// ============================================================
// Pure model selectors over `ModelSpec[]`
// ============================================================

const DEFAULT_PROVIDER_ID = 'openrouter';

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

/**
 * Select a model by `(providerId, modelId)`. Custom providers may share a
 * model id (`gpt-4.1`, ...) with each other or with OpenRouter, so id alone
 * is not unique.
 */
export function selectModel(
  modelsPool: ModelSpec[],
  selection: ModelSelection,
): ModelSpec | undefined {
  return modelsPool.find(
    (m) => m.providerId === selection.providerId && m.id === selection.modelId,
  );
}

function selectDefaultModel(
  modelsPool: ModelSpec[],
  defaultModelId: string | null,
): ModelSpec | undefined {
  if (modelsPool.length === 0) return undefined;
  if (defaultModelId) {
    const exact = modelsPool.find((m) => m.id === defaultModelId);
    if (exact) return exact;
  }
  return modelsPool[0];
}

function resolveValidModel(
  modelsPool: ModelSpec[],
  selection: ModelSelection,
  defaultModelId: string | null,
): ModelSpec | undefined {
  return selectModel(modelsPool, selection) ?? selectDefaultModel(modelsPool, defaultModelId);
}

/**
 * Sentinel id for the ephemeral staged-message preview synthesized by Insert
 * in the timeline 'developer' compose mode. The component lives inside
 * `sessionComponents` (mirroring the system-panel pattern) so every consumer
 * — interfaces, scroll hooks, click handlers — sees a single coherent list.
 */
const STAGED_PREVIEW_ID = '__staged_developer_preview__';

function buildStagedComponent(message: string): SessionComponent {
  return {
    id: STAGED_PREVIEW_ID,
    type: 'user-message',
    role: 'user',
    isStreaming: false,
    data: { message },
  } as unknown as SessionComponent;
}

/**
 * Pure helper: re-inject any active "ambient" components (system panels +
 * staged developer preview) into a freshly-derived `sessionComponents`
 * array. Used by every full-rederivation path (`hydrateFromEvents`,
 * `setUiInterface`).
 */
function injectAmbient(
  components: SessionComponent[],
  activePanels: Map<string, SessionComponentType>,
  stagedDeveloperMessage: string | null,
): SessionComponent[] {
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
  if (stagedDeveloperMessage !== null) {
    components.push(buildStagedComponent(stagedDeveloperMessage));
  }
  return components;
}

/**
 * Enforce business rules on agent config to maintain invariants.
 * Shared invariant enforcement for multi-agent configuration actions.
 */
function enforceConfigInvariants(
  config: AgentConfig,
  currentConfig: AgentConfig | null,
  toolsPool: import('../types/tools').Tool[],
  modelsPool: ModelSpec[],
  defaultModelId: string | null,
): AgentConfig {
  const requestedSelection: ModelSelection = {
    providerId: config.providerId ?? DEFAULT_PROVIDER_ID,
    modelId: config.modelId,
  };
  const selectedModel = resolveValidModel(modelsPool, requestedSelection, defaultModelId);
  const resolvedSelection: ModelSelection = {
    modelId: selectedModel?.id ?? config.modelId,
    providerId: selectedModel?.providerId ?? requestedSelection.providerId,
  };
  const currentSelection = currentConfig
    ? {
        providerId: currentConfig.providerId ?? DEFAULT_PROVIDER_ID,
        modelId: currentConfig.modelId,
      }
    : null;
  const hasModelChanged = Boolean(
    currentSelection &&
    (currentSelection.providerId !== resolvedSelection.providerId ||
      currentSelection.modelId !== resolvedSelection.modelId),
  );

  const finalConfig: AgentConfig = {
    ...config,
    modelId: resolvedSelection.modelId,
    providerId: resolvedSelection.providerId,
    // Model parameters are tuned per-model; carrying overlapping keys across a
    // model switch silently applies stale settings to a different request shape.
    providerParameters: hasModelChanged ? {} : { ...(config.providerParameters ?? {}) },
  };

  if (selectedModel) {
    // Drop provider parameters the selected model does not support.
    const supported = new Set(selectedModel.supportedParameters);
    for (const key of Object.keys(finalConfig.providerParameters)) {
      if (!supported.has(key)) delete finalConfig.providerParameters[key];
    }
  }

  if (!finalConfig.enableTools) {
    finalConfig.availableTools = [];
  } else {
    const existingTools = finalConfig.availableTools ?? [];
    const shouldAutoPopulate = !currentConfig?.enableTools || existingTools.length === 0;
    const nextTools = shouldAutoPopulate ? toolsPool : existingTools;
    finalConfig.availableTools = nextTools.filter(tool =>
      toolsPool.some(t => t.server === tool.server && t.tool === tool.tool)
    );
  }

  return finalConfig;
}

function normalizeAgents(
  incoming: Agent[],
  toolsPool: import('../types/tools').Tool[],
  modelsPool: ModelSpec[],
  defaultModelId: string | null,
): Agent[] {
  const seen = new Set<string>();
  const agents = incoming.flatMap((agent) => {
    if (seen.has(agent.agentId)) return [];
    seen.add(agent.agentId);
    return [{
      ...agent,
      config: enforceConfigInvariants(agent.config, agent.config, toolsPool, modelsPool, defaultModelId),
    }];
  });

  if (!seen.has('none')) {
    agents.unshift(createAssistantAgent(defaultModelId ?? undefined, modelsPool));
  }

  return agents;
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
  userMode: 'client' as 'developer' | 'client',
  stagedDeveloperMessage: null as string | null,

  // UI
  uiInterface: 'chat' as UIInterface,
  sessionComponents: [] as SessionComponent[],
  sessionEvents: [] as SessionEvent[],
  activePanels: new Map<string, SessionComponentType>(),
  persistSession: true,
  ephemeral: false,
  userMessagesHistory: [] as string[],
  
  // Tools
  toolsPool: [] as import('../types/tools').Tool[],
  workflowsPool: [] as import('../types/workflow').Workflow[],
  modelsPool: [] as import('../types/llm').ModelSpec[],
  modelParameters: [] as ModelParameterDefinition[],
  defaultModelId: null as string | null,
  selectedWorkflowId: '' as string,  // hydrated from localStorage in useHydrateStore
  
  // Per-agent runtime status (ephemeral)
  agentStatuses: { none: 'idle' } as Record<string, AgentStatus>,

  // Active workflow run status (ephemeral, session-scoped). Mirrors the
  // backend's run lifecycle. Source of truth lives in the workflow_*
  // system events; this field is the materialised view consumers read.
  workflowStatus: 'idle' as WorkflowStatus,
  workflowRunId: null as string | null,
  scrollToComponentId: null as string | null,
  preserveScrollOnSessionChange: false,
  error: null as string | null,
  submitTrigger: 0,
  
  // Editing
  editingEventId: null as string | null,
  editingData: null as import('../types/session').EditingData | null,
  
  // Selection (exclusive)
  // REMOVED: selectedComponentId selection feature has been removed

  // Branching
  showingBranchesForComponent: null as string | null,
  
  // Translation state
  preferredTranslationLanguage: null as string | null,
  translationCache: {} as Record<string, Record<string, string>>,
  activeTranslations: {} as Record<string, string | null>,
  translatingComponents: new Set<string>(),
  
  // Pending library items (asset or folder IDs) for message attachment
  pendingLibraryItemIds: [] as string[],

  rejectedTools: [] as { server: string; tool: string; code: string }[],
  mcpHostStatus: 'notConnected' as 'notConnected' | 'connected' | 'error',
  mcpClientStatus: 'notConnected' as 'notConnected' | 'connecting' | 'connected',
};

export const getStoreDefinition = (
  set: StoreApi<AgentState>['setState'],
  get: StoreApi<AgentState>['getState']
): AgentState => ({
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
  setCurrentSessionId: (currentSessionId) => {
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
    const { toolsPool, modelsPool, defaultModelId } = get();
    const agents = normalizeAgents(incoming, toolsPool, modelsPool, defaultModelId);
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
    const finalConfig = enforceConfigInvariants(rawConfig, currentConfig, get().toolsPool, get().modelsPool, get().defaultModelId);

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

  // Tool management
  setToolsPool: (toolsPool) => {
    const currentAgents = get().agents;
    const reconciled = normalizeAgents(currentAgents, toolsPool, get().modelsPool, get().defaultModelId);
    
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

  setLlmRegistry: (registry: LlmRegistrySnapshot) => {
    const modelsPool = registry.models;
    const currentAgents = get().agents;
    const agents = normalizeAgents(currentAgents, get().toolsPool, modelsPool, registry.defaultModelId);
    saveAgents(agents);
    set((state) => {
      const nextStatuses: Record<string, AgentStatus> = {};
      for (const a of agents) nextStatuses[a.agentId] = state.agentStatuses[a.agentId] ?? 'idle';
      return {
        modelsPool,
        defaultModelId: registry.defaultModelId,
        modelParameters: registry.parameters,
        agents,
        agentStatuses: nextStatuses,
      };
    });
  },

  // UI component actions
  setSessionComponents: (components) =>
    set((state) => ({
      sessionComponents: typeof components === 'function' ? components(state.sessionComponents) : components,
    })),

  appendEvent: (event: SessionEvent) => {
    set((state) => {
      const sessionEvents = [...state.sessionEvents, event];

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

      // ── Workflow status (session-scoped) ─────────────────────
      const wfMapped = workflowStatusFromEvent(event);
      const workflowStatus = wfMapped ?? state.workflowStatus;
      let workflowRunId = state.workflowRunId;
      if (event.type === 'workflow_started' || event.type === 'workflow_resumed') {
        workflowRunId = event.data.runId;
      }

      // ── Per-agent statuses ───────────────────────────────────
      // Lifecycle events drive bulk updates across every agent.
      const lifecycleStatuses = applyAgentStatusesForLifecycleEvent(
        state.agentStatuses,
        event,
        state.agents,
      );
      const agentStatuses = lifecycleStatuses ?? { ...state.agentStatuses };

      // For non-lifecycle events, apply the per-agent mapping. tool-effects
      // with pending userActions is the special case: the *agent* whose tool
      // produced the prompt is waiting for feedback, even though the
      // workflow as a whole is paused.
      if (!lifecycleStatuses && event.type !== 'user-input-committed') {
        const agentKey = event.agentId || 'none';
        if (event.type === 'tool-effects') {
          const { toolEffects } = event.data as ToolEffectsData;
          if (toolEffects?.userActions) {
            agentStatuses[agentKey] = 'waitingFeedback';
          } else {
            const mapped = agentStatusFromEvent(event);
            if (mapped) agentStatuses[agentKey] = mapped;
          }
        } else {
          const mapped = agentStatusFromEvent(event);
          if (mapped) agentStatuses[agentKey] = mapped;
        }
      }

      return {
        sessionEvents,
        sessionComponents,
        agentStatuses,
        workflowStatus,
        workflowRunId,
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

  hydrateFromEvents: (events: SessionEvent[]) => {
    const { activePanels, uiInterface, stagedDeveloperMessage } = get();
    const sessionComponents = injectAmbient(
      toSessionComponents(events, uiInterface),
      activePanels,
      stagedDeveloperMessage,
    );
    // Reconstruct WorkflowStatus + last runId from the persisted log so that
    // a session loaded mid-pause shows the correct affordances.
    const workflowStatus = deriveWorkflowStatus(events);
    let workflowRunId: string | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === 'workflow_started' || e.type === 'workflow_resumed') {
        workflowRunId = e.data.runId;
        break;
      }
    }
    set({ sessionEvents: events, sessionComponents, workflowStatus, workflowRunId });
  },

  clearEvents: () => set({
    sessionEvents: [],
    sessionComponents: [],
    activePanels: new Map(),
    // A fresh session has no pending compose — the staged preview is tied
    // to the just-cleared session context.
    stagedDeveloperMessage: null,
    workflowStatus: 'idle',
    workflowRunId: null,
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

  upsertSystemPanel: (panelId: string, panelType: SessionComponentType) =>
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
    const { sessionEvents, activePanels, stagedDeveloperMessage } = get();
    const sessionComponents = injectAmbient(
      toSessionComponents(sessionEvents, uiInterface),
      activePanels,
      stagedDeveloperMessage,
    );
    set({ uiInterface, sessionComponents });
  },

  setPersistSession: (persistSession) => {
    set({ persistSession });
  },

  setEphemeral: (ephemeral) => {
    set({ ephemeral });
  },
  
  // View mode actions (timeline workflow)
  setUserMode: (mode) => {
    set({ userMode: mode });
    // Switching away from 'developer' compose mode invalidates any staged
    // developer-text bubble (the Insert button is hidden in client mode,
    // so the user could no longer reach the staged content). Delegate to
    // setStagedDeveloperMessage so the synthetic component is removed from
    // sessionComponents in the same swing.
    if (mode !== 'developer') {
      get().setStagedDeveloperMessage(null);
    }
  },
  setStagedDeveloperMessage: (message) => {
    set((state) => {
      // Always strip any pre-existing staged component first — idempotent
      // for both insert (replace text) and clear paths.
      const sessionComponents = state.sessionComponents.filter(c => c.id !== STAGED_PREVIEW_ID);
      if (message !== null) {
        sessionComponents.push(buildStagedComponent(message));
      }
      return { stagedDeveloperMessage: message, sessionComponents };
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
      workflowStatus: 'idle',
      workflowRunId: null,
    });
  },

  setWorkflowStatus: (status: WorkflowStatus) => set({ workflowStatus: status }),

  setMcpStatus: (hostStatus: any, clientStatus: any) => set({ mcpHostStatus: hostStatus, mcpClientStatus: clientStatus }),
  setRejectedTools: (rejectedTools: any) => set({ rejectedTools }),
});

export const createAgentStore = () => createStore<AgentState>((set, get) => getStoreDefinition(set, get));

const useAgentStoreSingleton = create<AgentState>((set, get) => getStoreDefinition(set, get) as any);

export const AgentStoreContext = createContext<ReturnType<typeof createAgentStore> | null>(null);

export function AgentStoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createAgentStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentStore();
  }
  return React.createElement(AgentStoreContext.Provider, { value: storeRef.current }, children);
}

interface UseAgentStore {
  (): AgentState;
  <T>(selector: (state: AgentState) => T): T;
  getState: () => AgentState;
  setState: (val: any) => void;
  subscribe: (listener: any) => () => void;
}

export const useAgentStore: UseAgentStore = Object.assign(
  function useAgentStore<T>(selector?: (state: AgentState) => T) {
    const store = useContext(AgentStoreContext) ?? useAgentStoreSingleton;
    const sel = selector || ((s: AgentState) => s as any);
    return useStore(store, sel);
  },
  {
    getState: () => useAgentStoreSingleton.getState(),
    setState: (val: any) => useAgentStoreSingleton.setState(val),
    subscribe: (listener: any) => useAgentStoreSingleton.subscribe(listener),
  }
) as any;

// Export SessionComponent type for convenience
export type { SessionComponent } from '../types/session';
