'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Sends user_message via WS
 * - Mailbox client viewMode: wraps the typed text in <user_message>
 * - Mailbox developer viewMode: wraps the typed text in <developer_message>;
 *   when staged developer text exists, combines staged <developer_message>
 *   with current <user_message>
 *
 * Note: tool-triggered feedback is rendered as a sub-view inside
 * `AgentMessage` and dispatched directly via `useAgentCall().submitFeedback`.
 * The input area is always available and never enters a "feedback mode".
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentCall } from './useAgentCall';

const wrapUser = (text: string) => `<user_message>\n${text}\n</user_message>`;
const wrapDeveloper = (text: string) => `<developer_message>\n${text}\n</developer_message>`;

export function useUserInput() {
  const viewMode = useAgentStore((s) => s.viewMode);
  const stagedUserMessage = useAgentStore((s) => s.stagedUserMessage);
  const { submitMessage } = useAgentCall();

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

  return {
    submitUserInput,
    insertUserMessage,
    viewMode,
    stagedUserMessage,
  };
}
