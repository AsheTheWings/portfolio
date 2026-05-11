'use client';

/**
 * useAgent - Facade hook for accessing agent state and actions
 * Uses granular Zustand selectors to prevent unnecessary re-renders
 */

import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionLifecycle } from './useAgentSessionLifecycle';
import { useAgentCall } from './useAgentCall';

export function useAgent() {
  // Granular state selectors
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const agents = useAgentStore((state) => state.agents);
  // Derived: front agent's config for backward compat
  const agentConfig = useAgentStore((state) => state.agents[0]?.config ?? null);
  const sessionComponents = useAgentStore((state) => state.sessionComponents);
  const persistAgentSession = useAgentStore((state) => state.persistAgentSession);
  const ephemeral = useAgentStore((state) => state.ephemeral);
  const userMessagesHistory = useAgentStore((state) => state.userMessagesHistory);
  
  // Per-agent statuses (consumers aggregate via helpers in utils/agent-status)
  const agentStatuses = useAgentStore((state) => state.agentStatuses);
  const error = useAgentStore((state) => state.error);
  const scrollToComponentId = useAgentStore((state) => state.scrollToComponentId);
  const submitTrigger = useAgentStore((state) => state.submitTrigger);
  
  // UI interface
  const uiInterface = useAgentStore((state) => state.uiInterface);
  const setUiInterface = useAgentStore((state) => state.setUiInterface);
  
  // Editing
  const editingEventId = useAgentStore((state) => state.editingEventId);
  const editingData = useAgentStore((state) => state.editingData);
  const startEdit = useAgentStore((state) => state.startEdit);
  const updateEditingData = useAgentStore((state) => state.updateEditingData);
  
  // Tool state
  const toolsPool = useAgentStore((state) => state.toolsPool);
  
  // Workflow state
  const workflowsPool = useAgentStore((state) => state.workflowsPool);
  const selectedWorkflowId = useAgentStore((state) => state.selectedWorkflowId);
  
  // Models state
  const modelsPool = useAgentStore((state) => state.modelsPool);
  const modelParameters = useAgentStore((state) => state.modelParameters);
  const defaultModelId = useAgentStore((state) => state.defaultModelId);
  
  // Pending library items
  const pendingLibraryItemIds = useAgentStore((state) => state.pendingLibraryItemIds);
  const addPendingLibraryItems = useAgentStore((state) => state.addPendingLibraryItems);
  const removePendingLibraryItem = useAgentStore((state) => state.removePendingLibraryItem);
  const clearPendingLibraryItems = useAgentStore((state) => state.clearPendingLibraryItems);
  
  // Action selectors
  const setCurrentAgentSessionId = useAgentStore((state) => state.setCurrentAgentSessionId);
  const setAgentConfig = useAgentStore((state) => state.setAgentConfig);
  const setAgents = useAgentStore((state) => state.setAgents);
  const updateFrontAgentConfig = useAgentStore((state) => state.updateFrontAgentConfig);
  const setFrontAgent = useAgentStore((state) => state.setFrontAgent);
  const removeComponent = useAgentStore((state) => state.removeComponent);
  const upsertSystemPanel = useAgentStore((state) => state.upsertSystemPanel);
  const removeSystemPanel = useAgentStore((state) => state.removeSystemPanel);
  const clearSystemPanels = useAgentStore((state) => state.clearSystemPanels);
  const clearEvents = useAgentStore((state) => state.clearEvents);
  const setPersistAgentSession = useAgentStore((state) => state.setPersistAgentSession);
  const setEphemeral = useAgentStore((state) => state.setEphemeral);
  const setError = useAgentStore((state) => state.setError);
  const clearError = useAgentStore((state) => state.clearError);
  const setScrollToComponentId = useAgentStore((state) => state.setScrollToComponentId);
  const clearScrollToComponentId = useAgentStore((state) => state.clearScrollToComponentId);
  const setPreserveScrollOnSessionChange = useAgentStore((state) => state.setPreserveScrollOnSessionChange);
  const setAgentSessionComponents = useAgentStore((state) => state.setAgentSessionComponents);
  const cancelEdit = useAgentStore((state) => state.cancelEdit);
  const triggerSubmit = useAgentStore((state) => state.triggerSubmit);
  // Hook dependencies
  const { loadAgentSession, clearAgentSession } = useAgentSessionLifecycle();
  const { stopAgent, submitFeedback, resumeAgent } = useAgentCall();

  return {
    // Session
    currentSessionId,
    setCurrentAgentSessionId,
    
    // Configuration (multi-agent)
    agents,
    setAgents,
    updateFrontAgentConfig,
    setFrontAgent,
    
    // Compat: front agent config
    agentConfig,
    setAgentConfig,
    
    // UI state
    sessionComponents,
    userMessagesHistory,
    
    // Options
    persistAgentSession,
    ephemeral,
    
    // Per-agent runtime status map
    agentStatuses,
    error,
    scrollToComponentId,
    submitTrigger,
    
    // UI interface
    uiInterface,
    setUiInterface,
    
    // Editing
    editingEventId,
    editingData,
    startEdit,
    updateEditingData,

    // Component actions
    removeComponent,
    upsertSystemPanel,
    removeSystemPanel,
    clearSystemPanels,
    clearEvents,
    setAgentSessionComponents,
    
    // Control actions
    setPersistAgentSession,
    setEphemeral,
    
    // State actions
    setError,
    clearError,
    setScrollToComponentId,
    clearScrollToComponentId,
    setPreserveScrollOnSessionChange,
    cancelEdit,
    triggerSubmit,

    // Session actions
    loadAgentSession,
    clearAgentSession,
    
    // Agent actions (WS-driven)
    stopAgent,
    submitFeedback,
    resumeAgent,
    
    // Tool state
    toolsPool,
    
    // Workflow state
    workflowsPool,
    selectedWorkflowId,
    
    // Models state
    modelsPool,
    modelParameters,
    defaultModelId,
    
    // Pending library items
    pendingLibraryItemIds,
    addPendingLibraryItems,
    removePendingLibraryItem,
    clearPendingLibraryItems,
  };
}
