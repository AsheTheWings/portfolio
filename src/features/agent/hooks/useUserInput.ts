'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Normal mode: sends user_message via WS
 * - Feedback mode: sends submit_feedback via WS
 * - Mailbox client viewMode: wraps the typed text in <user_message>
 * - Mailbox developer viewMode: wraps the typed text in <developer_message>;
 *   when staged developer text exists, combines staged <developer_message>
 *   with current <user_message>
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentCall } from './useAgentCall';

const wrapUser = (text: string) => `<user_message>\n${text}\n</user_message>`;
const wrapDeveloper = (text: string) => `<developer_message>\n${text}\n</developer_message>`;

export function useUserInput() {
  const activeFeedbackRequest = useAgentStore((s) => s.activeFeedbackRequest);
  const viewMode = useAgentStore((s) => s.viewMode);
  const stagedUserMessage = useAgentStore((s) => s.stagedUserMessage);
  const { submitMessage, submitFeedback } = useAgentCall();

  /**
   * Submit user input — wraps each authored block in its author tag so
   * the backend persists a single user-turn message that the model parses
   * by tag (see backend `instructions-registry.ts` Conversational Roles).
   *
   *   - Client viewMode: outgoing payload is `<user_message>…</user_message>`.
   *   - Developer viewMode with staged text: payload is
   *     `<developer_message>STAGED</developer_message>` followed by the
   *     current input wrapped as `<user_message>…</user_message>` (when
   *     non-empty).
   *   - Developer viewMode with no staged text: the typed message is
   *     treated as the operator's voice and wrapped as `<developer_message>`.
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    if (viewMode === 'user') {
      submitMessage(wrapUser(message), libraryItemIds);
    } else if (stagedUserMessage !== null) {
      const stagedBlock = wrapDeveloper(stagedUserMessage);
      const userPart = message.trim() ? wrapUser(message) : '';
      const combined = userPart ? `${stagedBlock}\n${userPart}` : stagedBlock;
      useAgentStore.getState().setStagedUserMessage(null);
      submitMessage(combined, libraryItemIds);
    } else {
      submitMessage(wrapDeveloper(message), libraryItemIds);
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
