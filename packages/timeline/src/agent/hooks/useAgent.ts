'use client';

/**
 * useAgent - Facade hook for accessing agent state and actions
 * Uses granular Zustand selectors to prevent unnecessary re-renders
 */

import { useAgentStore } from '../stores/useAgentStore';
import { useSessionLifecycle } from './useSessionLifecycle';
import { useWorkflow } from './useWorkflow';

export function useAgent() {
  // Granular state selectors
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const agents = useAgentStore((state) => state.agents);
  // The front participant drives controls that edit one agent at a time.
  const agentConfig = useAgentStore((state) => state.agents[0]?.config ?? null);
  const sessionComponents = useAgentStore((state) => state.sessionComponents);
  const persistSession = useAgentStore((state) => state.persistSession);
  const ephemeral = useAgentStore((state) => state.ephemeral);
  const userMessagesHistory = useAgentStore((state) => state.userMessagesHistory);
  
  // Per-agent statuses (consumers aggregate via helpers in utils/status)
  const agentStatuses = useAgentStore((state) => state.agentStatuses);
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
  const setCurrentSessionId = useAgentStore((state) => state.setCurrentSessionId);
  const setAgents = useAgentStore((state) => state.setAgents);
  const updateFrontAgentConfig = useAgentStore((state) => state.updateFrontAgentConfig);
  const setFrontAgent = useAgentStore((state) => state.setFrontAgent);
  const removeComponent = useAgentStore((state) => state.removeComponent);
  const upsertSystemPanel = useAgentStore((state) => state.upsertSystemPanel);
  const removeSystemPanel = useAgentStore((state) => state.removeSystemPanel);
  const clearSystemPanels = useAgentStore((state) => state.clearSystemPanels);
  const clearEvents = useAgentStore((state) => state.clearEvents);
  const setPersistSession = useAgentStore((state) => state.setPersistSession);
  const setEphemeral = useAgentStore((state) => state.setEphemeral);
  const setScrollToComponentId = useAgentStore((state) => state.setScrollToComponentId);
  const clearScrollToComponentId = useAgentStore((state) => state.clearScrollToComponentId);
  const setPreserveScrollOnSessionChange = useAgentStore((state) => state.setPreserveScrollOnSessionChange);
  const setSessionComponents = useAgentStore((state) => state.setSessionComponents);
  const cancelEdit = useAgentStore((state) => state.cancelEdit);
  const triggerSubmit = useAgentStore((state) => state.triggerSubmit);
  // Hook dependencies
  const { loadSession, clearSession } = useSessionLifecycle();
  const { abortWorkflow, submitFeedback, resumeWorkflow } = useWorkflow();

  return {
    // Session
    currentSessionId,
    setCurrentSessionId,
    
    // Configuration (multi-agent)
    agents,
    setAgents,
    updateFrontAgentConfig,
    setFrontAgent,
    
    // Front-agent configuration
    agentConfig,
    
    // UI state
    sessionComponents,
    userMessagesHistory,
    
    // Options
    persistSession,
    ephemeral,
    
    // Per-agent runtime status map
    agentStatuses,
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
    setSessionComponents,
    
    // Control actions
    setPersistSession,
    setEphemeral,
    
    // State actions
    setScrollToComponentId,
    clearScrollToComponentId,
    setPreserveScrollOnSessionChange,
    cancelEdit,
    triggerSubmit,

    // Session actions
    loadSession,
    clearSession,
    
    // Agent actions (WS-driven)
    abortWorkflow,
    submitFeedback,
    resumeWorkflow,
    
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
