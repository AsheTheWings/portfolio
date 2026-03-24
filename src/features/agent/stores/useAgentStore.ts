'use client';

/**
 * Agent Store - Zustand state management for agent domain
 * Manages sessionsManager and UI state
 */

import { create } from 'zustand';
import { SessionsManager } from '../core/sessions-manager';
import type {
  McpConfig,
  McpHostStatus,
  McpClientStatus,
  AgentState,
} from '../types';
import { createDefaultAgentConfig, getModelSpec, hasCapability } from '../services/models-registry';
import { ModelCapability } from '../types';
import { saveAgentConfig } from '../utils/agent-storage';
import { toSessionComponents } from '../utils/toSessionComponent';


// Helper to set up MCP status change callback on a sessionsManager
const setupMcpCallback = (manager: SessionsManager) => {
  manager.setMcpStatusChangeCallback((hostStatus, clientStatus) => {
    const { setMcpHostStatus, setMcpClientStatus } = useAgentStore.getState();
    setMcpHostStatus(hostStatus);
    setMcpClientStatus(clientStatus);
  });
};

// Create sessionsManager instance
const sessionsManager = new SessionsManager();

const initialState = {
  // sessionsManager (created once)
  sessionsManager,
  currentSessionId: null,
  agentConfig: createDefaultAgentConfig(), // Start with defaults to avoid hydration mismatch
  
  // Hydration state
  _hydrated: false,
  
  // Initial config panel shown (prevents re-showing on route changes)
  _hasShownInitialConfig: false,
  
  // UI
  uiMode: 'chat' as const,
  sessionComponents: [],
  persistSession: true,
  ephemeral: false,
  userMessagesHistory: [],
  
  // Tools
  toolsPool: [],
  mcpServerStatus: {},
  mcpHostStatus: 'notConnected' as McpHostStatus,
  mcpClientStatus: 'notConnected' as McpClientStatus,
  mcpError: null,
  
  // State
  conversationStatus: 'healthy' as const,
  scrollToComponentId: null,
  error: null,
  submitTrigger: 0,
  abortController: null as AbortController | null,
  
  // Editing
  editingComponentId: null,
  editingData: null,
  
  // Branching
  showingBranchesForComponent: null,
  
  // Feedback mode
  activeFeedbackRequest: null,
  
  // job UI state
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

  setAbortController: (abortController: AbortController | null) => {
    set({ abortController });
  },

  /**
   * Stop current agent execution
   * Aborts the ongoing agent loop if running
   */
  stopAgent: () => {
    const abortController = get().abortController;
    if (abortController) {
      abortController.abort();
      set({ abortController: null });
    }
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
  getCurrentSession: () => {
    const { sessionsManager, currentSessionId } = get();
    return currentSessionId ? sessionsManager.getSession(currentSessionId) : undefined;
  },

  setCurrentSessionId: (currentSessionId) => {
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
      // Enabling tools: populate with all tools from pool
      finalConfig.availableTools = toolsPool;
    } else if (!finalConfig.enableTools) {
      // Disabling tools: clear availableTools
      finalConfig.availableTools = [];
    }
    
    // Persist to localStorage
    saveAgentConfig(finalConfig);
    
    set({ agentConfig: finalConfig });
  },

  // UI component actions
  setSessionComponents: (components) =>
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
            // Completed events (isStreaming=false) replace accumulated chunks
            if (!component.isStreaming) return component.data.message;
            return existing.data.message + component.data.message;
          })();
          
          // Append-merge for thoughts (string concatenation for streaming)
          // Only append if incoming is a chunk (isStreaming=true), otherwise replace
          const mergedThoughts = (() => {
            if (component.data.thoughts === undefined) return existing.data.thoughts;
            if (existing.data.thoughts === undefined) return component.data.thoughts;
            // Completed events (isStreaming=false) replace accumulated chunks
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
            // role: don't let system role overwrite existing role
            role: (component.role === 'system' && existing.role !== 'system') 
              ? existing.role 
              : component.role,
            // isStreaming: last event wins (chunk → completed transition)
            isStreaming: component.isStreaming,
            // hideComponent: first event wins
            hideComponent: existing.hideComponent ?? component.hideComponent,
            // controls: last event wins
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
          // Add new component
          updated = [...updated, component];
        }
      }
      
      return { sessionComponents: updated };
    }),

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

  setPersistSession: (persistSession) => {
    const session = get().getCurrentSession();
    
    if (session) {
      session.updateOptions({ persist: persistSession });
    }
    
    set({ persistSession });
  },

  setEphemeral: (ephemeral) => {
    const session = get().getCurrentSession();
    
    if (session) {
      session.updateOptions({ ephemeral });
    }
    
    set({ ephemeral });
  },
  
  // User messages history actions
  setUserMessagesHistory: (history) => {
    set({ userMessagesHistory: history.slice(0, 20) }); // Keep max 20 messages
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
  
  // Tool actions
  initializeToolsPool: async () => {
    const sessionsManager = get().sessionsManager;
    try {
      await sessionsManager.initializeToolsPool();
      const toolsPool = sessionsManager.getToolsPool();
      const agentConfig = get().agentConfig;
      
      // Auto-populate availableTools if enableTools is true and availableTools is empty
      // Note: Status updates are handled by callback, no need to poll here
      if (agentConfig?.enableTools && agentConfig.availableTools.length === 0 && toolsPool.length > 0) {
        set({
          toolsPool,
          agentConfig: {
            ...agentConfig,
            availableTools: toolsPool,
          },
        });
      } else {
        set({ toolsPool });
      }
    } catch (err: unknown) {
      console.error('Failed to initialize tools pool:', err);
    }
  },

  refreshToolsPool: async () => {
    const sessionsManager = get().sessionsManager;
    try {
      await sessionsManager.refreshToolsPool();
      const toolsPool = sessionsManager.getToolsPool();
      const mcpServerStatus = sessionsManager.getServerInfo();
      const agentConfig = get().agentConfig;
      
      // Auto-populate availableTools if enableTools is true and availableTools is empty
      // Note: Status updates are handled by callback, no need to poll here
      if (agentConfig?.enableTools && agentConfig.availableTools.length === 0 && toolsPool.length > 0) {
        set({
          toolsPool,
          mcpServerStatus,
          agentConfig: {
            ...agentConfig,
            availableTools: toolsPool,
          },
        });
      } else {
        set({ toolsPool, mcpServerStatus });
      }
    } catch (err: unknown) {
      set({ mcpError: err instanceof Error ? err.message : 'Failed to refresh tools' });
    }
  },

  connectMcp: async (config: McpConfig) => {
    const sessionsManager = get().sessionsManager;
    
    // Set connecting status immediately for UI feedback
    set({ 
      mcpClientStatus: 'connecting',
      mcpError: null,
    });
    
    try {
      await sessionsManager.connectMcp(config);
      // Tools pool and available tools are updated by setMcpHostStatus callback
    } catch (err: unknown) {
      // Status is already set to 'error' by callback from McpClient
      set({ mcpError: err instanceof Error ? err.message : 'Connection failed' });
      throw err;
    }
  },

  disconnectMcp: async () => {
    const sessionsManager = get().sessionsManager;
    try {
      await sessionsManager.disconnectMcp();
      // Status and tools cleanup handled by setMcpHostStatus callback
      set({ mcpError: null });
    } catch (err: unknown) {
      console.error('Failed to disconnect MCP:', err);
    }
  },

  setMcpHostStatus: (mcpHostStatus) => {
    set({ mcpHostStatus });
  },
  
  setMcpClientStatus: (mcpClientStatus) => {
    const prevStatus = get().mcpClientStatus;
    
    // Update tools pool when client connects (servers connected, tools loaded)
    if (mcpClientStatus === 'connected' && prevStatus !== 'connected') {
      const sessionsManager = get().sessionsManager;
      const newToolsPool = sessionsManager.getToolsPool();
      const mcpServerStatus = sessionsManager.getServerInfo();
      const currentConfig = get().agentConfig;
      
      // Determine actual status based on server state
      let actualStatus: McpClientStatus = 'connected';
      const serverCount = Object.keys(mcpServerStatus).length;
      
      if (serverCount === 0) {
        // No servers configured → idle
        actualStatus = 'idle';
      } else {
        // Check if all servers are in error state
        const allServersInError = Object.values(mcpServerStatus).every(
          (info) => typeof info === 'object' && info !== null && 'status' in info && (info as { status: string }).status === 'error'
        );
        if (allServersInError) {
          actualStatus = 'error';
        }
      }
      
      // Auto-add new MCP tools to availableTools if enableTools is true
      if (currentConfig?.enableTools && newToolsPool.length > 0) {
        const currentToolKeys = new Set(currentConfig.availableTools.map(t => `${t.server}:${t.tool}`));
        const newTools = newToolsPool.filter(tool => !currentToolKeys.has(`${tool.server}:${tool.tool}`));
        
        if (newTools.length > 0) {
          const updatedConfig = {
            ...currentConfig,
            availableTools: [...currentConfig.availableTools, ...newTools],
          };
          
          // Persist updated config to localStorage
          saveAgentConfig(updatedConfig);
          
          set({ 
            mcpClientStatus: actualStatus,
            toolsPool: newToolsPool,
            mcpServerStatus,
            agentConfig: updatedConfig,
          });
          return;
        }
      }
      
      set({ 
        mcpClientStatus: actualStatus,
        toolsPool: newToolsPool,
        mcpServerStatus,
      });
    }
    // Clean up MCP tools when client disconnects (idle, notConnected, error)
    else if ((mcpClientStatus === 'idle' || mcpClientStatus === 'notConnected' || mcpClientStatus === 'error') && 
             prevStatus !== mcpClientStatus) {
      const sessionsManager = get().sessionsManager;
      const newToolsPool = sessionsManager.getToolsPool();
      const currentConfig = get().agentConfig;
      
      // Filter out MCP tools from availableTools
      const filteredAvailableTools = currentConfig?.availableTools.filter(
        tool => tool.source === 'builtIn'
      ) || [];
      
      const updatedConfig = currentConfig ? {
        ...currentConfig,
        availableTools: filteredAvailableTools,
      } : null;
      
      if (updatedConfig) {
        // Persist updated config to localStorage
        saveAgentConfig(updatedConfig);
      }
      
      set({ 
        mcpClientStatus,
        toolsPool: newToolsPool,
        mcpServerStatus: {},
        agentConfig: updatedConfig,
      });
    }
    else {
      set({ mcpClientStatus });
    }
  },
  setMcpError: (mcpError) => set({ mcpError }),
  // Editing actions
  startEdit: (componentId, initialData) => {
    // initialData can be string (message) or object (tool)
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

  /**
   * Submit user feedback result
   * Adds user-feedback-result event to session memory
   * 
   * @param result - User feedback data (action, text, etc.)
   */
  submitFeedback: (result: Record<string, unknown>) => {
    const session = get().getCurrentSession();
    const feedbackRequest = get().activeFeedbackRequest;
    
    if (!session || !feedbackRequest) {
      console.warn('⚠️ Cannot submit feedback: No active session or feedback request');
      return;
    }

    // Add user-feedback-result event to session
    const feedbackResultEvent = session.addUserFeedbackResult(feedbackRequest.componentId, result);
    
    // Build component from feedback result event
    if (feedbackResultEvent) {
      get().upsertComponent(toSessionComponents(feedbackResultEvent));
    }
    
    // Clear feedback mode in store
    set({ activeFeedbackRequest: null });
  },

  /**
   * Select a job to view in BackgroundJobInterface
   */
  selectJob: (jobId: string | null) => {
    set({ selectedJobId: jobId });
  },

  /**
   * Cancel a job (user-initiated)
   * Stops agent, emits cancel_job tool call, upserts component for immediate feedback
   */
  cancelJob: (jobId: string) => {
    const session = get().getCurrentSession();
    if (!session) {
      console.warn('cancelJob: no active session');
      return;
    }

    // Stop agent if running
    const abortController = get().abortController;
    if (abortController) {
      abortController.abort();
      set({ abortController: null });
    }

    // Emit system tool call for _system_action cancel (not cancel_job which is agent-reserved)
    const toolCallEvent = session.emitSystemToolCall({
      server: 'agent-job',
      tool: 'manage',
      arguments: {
        action: '_system_action',
        job_id: jobId,
        operation: 'cancel',
        caller: 'system',
        trigger: 'user',
        trigger_source: 'terminate_button',
      },
    });

    // Upsert component for immediate UI feedback
    get().upsertComponent(toSessionComponents(toolCallEvent));
  },

  /**
   * Set active job context (synced from Session via tool effects)
   */
  setActiveJob: (job: { jobId: string; title: string } | null) => {
    set({ activeJob: job });
  },

  /**
   * Get the last visible component ID for each job (for floating action buttons)
   * Ignores hidden components (background dashboard) so buttons appear on visible UI
   */
  getLastComponentByJob: () => {
    const map: Record<string, string> = {};
    for (const c of get().sessionComponents) {
      if (c.data.jobId && !c.hideComponent) {
        map[c.data.jobId] = c.id;  // Last visible one wins
      }
    }
    return map;
  },

  /**
   * Set preferred translation language (persisted for shift+click quick translate)
   */
  setPreferredTranslationLanguage: (language: string | null) => {
    set({ preferredTranslationLanguage: language });
  },

  /**
   * Cache a translation for a component
   */
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

  /**
   * Set active translation for a component (null = show original)
   */
  setActiveTranslation: (componentId: string, language: string | null) => {
    set((state) => ({
      activeTranslations: {
        ...state.activeTranslations,
        [componentId]: language,
      },
    }));
  },

  /**
   * Reset all translations (global Escape)
   */
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
  // Reset store (create fresh sessionsManager instance)
  reset: () => {
    const newSessionsManager = new SessionsManager();
    setupMcpCallback(newSessionsManager);  // Set up callback on new instance
    set({
      ...initialState,
      sessionsManager: newSessionsManager,
      conversationStatus: 'healthy',
      abortController: null,
    });
  },
}));

// Set up MCP status change callback on initial sessionsManager
// This allows McpClient to push status updates immediately to the store
setupMcpCallback(sessionsManager);

// Export SessionComponent type for convenience
export type { SessionComponent } from '../types';
