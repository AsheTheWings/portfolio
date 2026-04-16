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
   * Submit user input — text always creates a new message.
   * Feedback is exclusively button-driven via submitAction.
   * Typing during waitingFeedback finalizes the pending turn and starts fresh.
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    submitMessage(message, libraryItemIds);
  }, [submitMessage]);

  /**
   * Submit action button click (feedback mode only)
   */
  const submitAction = useCallback(async (actionId: string) => {
    if (!activeFeedbackRequest) {
      console.warn('Cannot submit action: Not in feedback mode');
      return;
    }
    submitFeedback(activeFeedbackRequest.toolCallEventId, { action: actionId });
  }, [activeFeedbackRequest, submitFeedback]);

  return {
    submitUserInput,
    submitAction,
    isFeedbackMode: activeFeedbackRequest !== null,
  };
}
