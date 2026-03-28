'use client';

/**
 * useUserInput Hook
 * 
 * Consolidates user input handling:
 * - Normal mode: sends user_message via WS
 * - Feedback mode: sends submit_feedback via WS
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentCall } from './useAgentCall';

export function useUserInput() {
  const activeFeedbackRequest = useAgentStore((s) => s.activeFeedbackRequest);
  const { submitMessage, submitFeedback } = useAgentCall();

  /**
   * Submit user input — routes to feedback or normal message
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    if (activeFeedbackRequest) {
      submitFeedback(activeFeedbackRequest.componentId, { userFeedback: message });
    } else {
      submitMessage(message, libraryItemIds);
    }
  }, [activeFeedbackRequest, submitFeedback, submitMessage]);

  /**
   * Submit action button click (feedback mode only)
   */
  const submitAction = useCallback(async (actionId: string) => {
    if (!activeFeedbackRequest) {
      console.warn('Cannot submit action: Not in feedback mode');
      return;
    }
    submitFeedback(activeFeedbackRequest.componentId, { action: actionId });
  }, [activeFeedbackRequest, submitFeedback]);

  return {
    submitUserInput,
    submitAction,
    isFeedbackMode: activeFeedbackRequest !== null,
  };
}
