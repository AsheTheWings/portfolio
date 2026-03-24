'use client';

/**
 * useUserInput Hook
 * 
 * Single Responsibility: Consolidate all user input handling
 * - Detects feedback mode vs normal mode
 * - Routes to appropriate handler (feedback submission vs message sending)
 * - Encapsulates business logic away from components
 * 
 * This hook provides a unified interface for all user text input,
 * eliminating the need for components to handle mode switching logic.
 */

import { useCallback } from 'react';
import { useAgent } from './useAgent';

/**
 * Hook for handling user input in both normal and feedback modes
 */
export function useUserInput() {
  const {
    activeFeedbackRequest,
    submitFeedback: submitFeedbackAction,
    callAgent,
    resumeAgent,
  } = useAgent();

  /**
   * Submit user input (text message with optional asset attachments)
   * Automatically detects feedback mode and routes to appropriate handler
   * 
   * @param message - User's text input
   * @param libraryItemIds - Optional library item IDs (assets or folders) to attach
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    if (activeFeedbackRequest) {
      // Feedback mode: submit as tool result with user feedback
      submitFeedbackAction({ userFeedback: message });
      
      // Resume agent loop after feedback submission
      await resumeAgent();
    } else {
      // Normal mode: send as user message with optional library items
      await callAgent(message, libraryItemIds);
    }
  }, [activeFeedbackRequest, submitFeedbackAction, resumeAgent, callAgent]);

  /**
   * Submit action button click (feedback mode only)
   * 
   * @param actionId - ID of the clicked action button
   */
  const submitAction = useCallback(async (actionId: string) => {
    if (!activeFeedbackRequest) {
      console.warn('⚠️ Cannot submit action: Not in feedback mode');
      return;
    }

    // Submit action as tool result
    submitFeedbackAction({ action: actionId });
    
    // Resume agent loop to process queued tools
    await resumeAgent();
  }, [activeFeedbackRequest, submitFeedbackAction, resumeAgent]);

  return {
    submitUserInput,
    submitAction,
    isFeedbackMode: activeFeedbackRequest !== null,
  };
}
