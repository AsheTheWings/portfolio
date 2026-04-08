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
  
  // Conversation status
  const conversationStatus = useAgentStore((state) => state.conversationStatus);
  const error = useAgentStore((state) => state.error);
  const scrollToComponentId = useAgentStore((state) => state.scrollToComponentId);
  const submitTrigger = useAgentStore((state) => state.submitTrigger);
  
  // Feedback mode
  const activeFeedbackRequest = useAgentStore((state) => state.activeFeedbackRequest);
  
  // UI mode
  const uiMode = useAgentStore((state) => state.uiMode);
  const setUiMode = useAgentStore((state) => state.setUiMode);
  
  // Background job UI
  const selectedJobId = useAgentStore((state) => state.selectedJobId);
  const selectJob = useAgentStore((state) => state.selectJob);
  const activeJob = useAgentStore((state) => state.activeJob);
  const setActiveJob = useAgentStore((state) => state.setActiveJob);
  const getLastComponentByJob = useAgentStore((state) => state.getLastComponentByJob);
  
  // Editing
  const editingComponentId = useAgentStore((state) => state.editingComponentId);
  const editingData = useAgentStore((state) => state.editingData);
  const startEdit = useAgentStore((state) => state.startEdit);
  const updateEditingData = useAgentStore((state) => state.updateEditingData);
  
  // Tool state
  const toolsPool = useAgentStore((state) => state.toolsPool);
  
  // Workflow state
  const workflowsPool = useAgentStore((state) => state.workflowsPool);
  
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
  const upsertComponent = useAgentStore((state) => state.upsertComponent);
  const clearComponents = useAgentStore((state) => state.clearComponents);
  const removeComponent = useAgentStore((state) => state.removeComponent);
  const removeComponentsByType = useAgentStore((state) => state.removeComponentsByType);
  const removeComponentsByRole = useAgentStore((state) => state.removeComponentsByRole);
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
  const setActiveFeedbackRequest = useAgentStore((state) => state.setActiveFeedbackRequest);
  
  // Hook dependencies
  const { loadAgentSession, clearAgentSession } = useAgentSessionLifecycle();
  const { submitMessage, stopAgent, submitFeedback, resumeAgent } = useAgentCall();

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
    
    // Processing state
    conversationStatus,
    error,
    scrollToComponentId,
    submitTrigger,
    
    // Feedback mode
    activeFeedbackRequest,
    setActiveFeedbackRequest,
    
    // UI mode
    uiMode,
    setUiMode,
    
    // Background job UI
    selectedJobId,
    selectJob,
    activeJob,
    setActiveJob,
    getLastComponentByJob,
    
    // Editing
    editingComponentId,
    editingData,
    startEdit,
    updateEditingData,

    // Component actions
    upsertComponent,
    clearComponents,
    removeComponent,
    removeComponentsByType,
    removeComponentsByRole,
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
    submitMessage,
    stopAgent,
    submitFeedback,
    resumeAgent,
    
    // Tool state
    toolsPool,
    
    // Workflow state
    workflowsPool,
    
    // Pending library items
    pendingLibraryItemIds,
    addPendingLibraryItems,
    removePendingLibraryItem,
    clearPendingLibraryItems,
  };
}
