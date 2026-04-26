'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Normal mode: sends user_message via WS
 * - Feedback mode: sends submit_feedback via WS
 * - Timeline client mode: wraps message in <client> tags
 * - Timeline user mode: supports Insert (stage) + Submit (combine)
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentCall } from './useAgentCall';

export function useUserInput() {
  const activeFeedbackRequest = useAgentStore((s) => s.activeFeedbackRequest);
  const viewMode = useAgentStore((s) => s.viewMode);
  const stagedUserMessage = useAgentStore((s) => s.stagedUserMessage);
  const { submitMessage, submitFeedback } = useAgentCall();

  /**
   * Submit user input — handles viewMode routing.
   * - Client mode: wraps message in <client> tags automatically
   * - Developer mode with staged: combines staged developer text + <client> wrapped current text
   * - Developer mode without staged: sends plain developer message
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    if (viewMode === 'client') {
      // Client mode — wrap in <client> tags, no developer text
      submitMessage(`<client>${message}</client>`, libraryItemIds);
    } else if (stagedUserMessage !== null) {
      // Developer mode with staged text — combine with client content
      const clientPart = message.trim() ? `<client>${message}</client>` : '';
      const combined = clientPart
        ? `${stagedUserMessage}\n${clientPart}`
        : stagedUserMessage;
      useAgentStore.getState().setStagedUserMessage(null);
      submitMessage(combined, libraryItemIds);
    } else {
      // Developer mode — plain developer message
      submitMessage(message, libraryItemIds);
    }
  }, [viewMode, stagedUserMessage, submitMessage]);

  /**
   * Insert action (developer mode only) — stages the current input text without submitting.
   * The staged text will be combined with client content on next Submit.
   */
  const insertUserMessage = useCallback((text: string) => {
    useAgentStore.getState().setStagedUserMessage(text);
  }, []);

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
    insertUserMessage,
    submitAction,
    viewMode,
    stagedUserMessage,
    isFeedbackMode: activeFeedbackRequest !== null,
  };
}
