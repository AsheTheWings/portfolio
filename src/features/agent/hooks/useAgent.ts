'use client';

/**
 * useAgent - Custom hook for accessing agent state and actions
 * Uses granular Zustand selectors to prevent unnecessary re-renders
 * Provides a convenient single hook instead of multiple useAgentStore calls
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useSessionLifecycle } from './useSessionLifecycle';
import { useAgentCall } from './useAgentCall';

/**
 * Hook to access agent state and actions via Zustand
 * Uses granular selectors to prevent unnecessary re-renders
 * Updated for new sessionsManager architecture
 */
export function useAgent() {
  // Granular state selectors - each subscribes independently
  const sessionsManager = useAgentStore((state) => state.sessionsManager);
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const agentConfig = useAgentStore((state) => state.agentConfig);
  const sessionComponents = useAgentStore((state) => state.sessionComponents);
  const persistSession = useAgentStore((state) => state.persistSession);
  const ephemeral = useAgentStore((state) => state.ephemeral);
  const userMessagesHistory = useAgentStore((state) => state.userMessagesHistory);
  
  // Conversation status
  const conversationStatus = useAgentStore((state) => state.conversationStatus);
  const error = useAgentStore((state) => state.error);
  const scrollToComponentId = useAgentStore((state) => state.scrollToComponentId);
  const submitTrigger = useAgentStore((state) => state.submitTrigger);
  
  // Feedback mode states
  const activeFeedbackRequest = useAgentStore((state) => state.activeFeedbackRequest);
  const submitFeedback = useAgentStore((state) => state.submitFeedback);
  
  // UI mode state
  const uiMode = useAgentStore((state) => state.uiMode);
  const setUiMode = useAgentStore((state) => state.setUiMode);
  
  // Background job UI state
  const selectedJobId = useAgentStore((state) => state.selectedJobId);
  const selectJob = useAgentStore((state) => state.selectJob);
  const cancelJob = useAgentStore((state) => state.cancelJob);
  const activeJob = useAgentStore((state) => state.activeJob);
  const setActiveJob = useAgentStore((state) => state.setActiveJob);
  const getLastComponentByJob = useAgentStore((state) => state.getLastComponentByJob);
  
  // Editing states
  const editingComponentId = useAgentStore((state) => state.editingComponentId);
  const editingData = useAgentStore((state) => state.editingData);
  const startEdit = useAgentStore((state) => state.startEdit);
  const updateEditingData = useAgentStore((state) => state.updateEditingData);
  
  // Tool state
  const toolsPool = useAgentStore((state) => state.toolsPool);
  const mcpServerStatus = useAgentStore((state) => state.mcpServerStatus);
  const mcpHostStatus = useAgentStore((state) => state.mcpHostStatus);
  const mcpClientStatus = useAgentStore((state) => state.mcpClientStatus);
  const mcpError = useAgentStore((state) => state.mcpError);
  
  // Pending library items for message attachment
  const pendingLibraryItemIds = useAgentStore((state) => state.pendingLibraryItemIds);
  const addPendingLibraryItems = useAgentStore((state) => state.addPendingLibraryItems);
  const removePendingLibraryItem = useAgentStore((state) => state.removePendingLibraryItem);
  const clearPendingLibraryItems = useAgentStore((state) => state.clearPendingLibraryItems);
  
  // Action selectors (stable - won't cause re-renders)
  const getCurrentSession = useAgentStore((state) => state.getCurrentSession);
  const setCurrentSessionId = useAgentStore((state) => state.setCurrentSessionId);
  const setAgentConfig = useAgentStore((state) => state.setAgentConfig);
  const upsertComponent = useAgentStore((state) => state.upsertComponent);
  const clearComponents = useAgentStore((state) => state.clearComponents);
  const removeComponent = useAgentStore((state) => state.removeComponent);
  const removeComponentsByType = useAgentStore((state) => state.removeComponentsByType);
  const removeComponentsByRole = useAgentStore((state) => state.removeComponentsByRole);
  const setPersistSession = useAgentStore((state) => state.setPersistSession);
  const setEphemeral = useAgentStore((state) => state.setEphemeral);
  const setError = useAgentStore((state) => state.setError);
  const clearError = useAgentStore((state) => state.clearError);
  const setScrollToComponentId = useAgentStore((state) => state.setScrollToComponentId);
  const clearScrollToComponentId = useAgentStore((state) => state.clearScrollToComponentId);
  const setSessionComponents = useAgentStore((state) => state.setSessionComponents);
  const cancelEdit = useAgentStore((state) => state.cancelEdit);
  const triggerSubmit = useAgentStore((state) => state.triggerSubmit);
  const initializeToolsPool = useAgentStore((state) => state.initializeToolsPool);
  const refreshToolsPool = useAgentStore((state) => state.refreshToolsPool);
  const connectMcp = useAgentStore((state) => state.connectMcp);
  const disconnectMcp = useAgentStore((state) => state.disconnectMcp);
  const setMcpHostStatus = useAgentStore((state) => state.setMcpHostStatus);
  const setMcpClientStatus = useAgentStore((state) => state.setMcpClientStatus);
  const setMcpError = useAgentStore((state) => state.setMcpError);
  
  // Hook dependencies
  const { createSession, loadSession, clearSession } = useSessionLifecycle();
  const { callAgent, resumeAgent, stopAgent } = useAgentCall();

  return {
    // Session management
    sessionsManager,
    currentSessionId,
    getCurrentSession,
    setCurrentSessionId,
    
    // Configuration
    agentConfig,
    setAgentConfig,
    
    // UI state
    sessionComponents,
    userMessagesHistory,
    
    // Options
    persistSession,
    ephemeral,
    
    // Processing state
    conversationStatus,
    error,
    scrollToComponentId,
    submitTrigger,
    
    // Feedback mode
    activeFeedbackRequest,
    submitFeedback,
    
    // UI mode
    uiMode,
    setUiMode,
    
    // Background job UI
    selectedJobId,
    selectJob,
    cancelJob,
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
    setSessionComponents,
    
    // Control actions
    setPersistSession,
    setEphemeral,
    
    // State actions
    setError,
    clearError,
    setScrollToComponentId,
    clearScrollToComponentId,
    cancelEdit,
    triggerSubmit,

    // Session actions
    createSession,
    loadSession,
    clearSession,
    
    // Agent actions
    callAgent,
    resumeAgent,
    stopAgent,
    
    // Tool state
    toolsPool,
    mcpServerStatus,
    mcpHostStatus,
    mcpClientStatus,
    mcpError,
    
    // Tool actions
    initializeToolsPool,
    refreshToolsPool,
    connectMcp,
    disconnectMcp,
    setMcpHostStatus,
    setMcpClientStatus,
    setMcpError,
    
    // Pending library items
    pendingLibraryItemIds,
    addPendingLibraryItems,
    removePendingLibraryItem,
    clearPendingLibraryItems,
  };
}
