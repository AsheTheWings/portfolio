'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Sends user_message via WS
 * - Submit always wraps current composer text in <user_message>
 * - Insert, available in developer viewMode, stages <developer_message> content;
 *   the next submit sends the staged developer block plus optional user content
 *
 * Note: tool-triggered feedback is rendered as a sub-view inside
 * `AgentMessage` and dispatched directly via `useWorkflow().submitFeedback`.
 * The input area is always available and never enters a "feedback mode".
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useWorkflow } from './useWorkflow';

const wrapUser = (text: string) => `<user_message>\n${text}\n</user_message>`;
const wrapDeveloper = (text: string) => `<developer_message>\n${text}\n</developer_message>`;

export function useUserInput() {
  const viewMode = useAgentStore((s) => s.viewMode);
  const stagedDeveloperMessage = useAgentStore((s) => s.stagedDeveloperMessage);
  const { submitMessage } = useWorkflow();

  /**
   * Submit composer content. The typed message is always the app user's voice
   * and therefore always wrapped as `<user_message>…</user_message>`.
   * Developer-authored content can only enter the outgoing turn through Insert,
   * which stages a `<developer_message>…</developer_message>` block.
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    const trimmed = message.trim();
    const hasLibraryItems = (libraryItemIds?.length ?? 0) > 0;
    const userBlock = trimmed || hasLibraryItems ? wrapUser(trimmed) : '';

    if (stagedDeveloperMessage !== null) {
      const stagedBlock = wrapDeveloper(stagedDeveloperMessage);
      const combined = userBlock ? `${stagedBlock}\n${userBlock}` : stagedBlock;
      useAgentStore.getState().setStagedDeveloperMessage(null);
      submitMessage(combined, libraryItemIds);
      return;
    }

    if (userBlock) {
      submitMessage(userBlock, libraryItemIds);
    }
  }, [stagedDeveloperMessage, submitMessage]);

  /**
   * Insert action (developer mode only) — stages the current input text as
   * developer-authored content without submitting.
   */
  const insertDeveloperMessage = useCallback((text: string) => {
    useAgentStore.getState().setStagedDeveloperMessage(text);
  }, []);

  return {
    submitUserInput,
    insertDeveloperMessage,
    viewMode,
    stagedDeveloperMessage,
  };
}
