'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Sends user_message via WS
 * - Submit always wraps current composer text in <client_user>
 * - Insert, available in developer userMode, stages <developer_user> content;
 *   the next submit sends the staged developer block plus optional client content
 *
 * Note: tool-triggered feedback is rendered as a sub-view inside
 * `AgentMessage` and dispatched directly via `useWorkflow().submitFeedback`.
 * The input area is always available and never enters a "feedback mode".
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useWorkflow } from './useWorkflow';

const wrapUser = (text: string) => `<client_user>\n${text}\n</client_user>`;
const wrapDeveloper = (text: string) => `<developer_user>\n${text}\n</developer_user>`;

export function useUserInput() {
  const userMode = useAgentStore((s) => s.userMode);
  const stagedDeveloperMessage = useAgentStore((s) => s.stagedDeveloperMessage);
  const { submitMessage } = useWorkflow();

  /**
   * Submit composer content. The typed message is always the app client's voice
   * and therefore always wrapped as `<client_user>…</client_user>`.
   * Developer-authored content can only enter the outgoing turn through Insert,
   * which stages a `<developer_user>…</developer_user>` block.
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
    userMode,
    stagedDeveloperMessage,
  };
}
