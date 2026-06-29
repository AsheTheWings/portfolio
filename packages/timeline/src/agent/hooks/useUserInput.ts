'use client';

/**
 * useUserInput Hook
 *
 * Consolidates user input handling:
 * - Sends user_message via WS
 * - Submit wraps current composer text in <client_user> (trimmed; skipped when
 *   the input is already correctly tagged)
 * - Insert, available in developer userMode, stages <developer_user> content;
 *   the next submit sends the staged developer block plus optional client content
 *
 * Wrapping/trimming/already-tagged detection is centralized in
 * `../utils/user-tags` and shared with the render path (`UserMessage`).
 *
 * Note: tool-triggered feedback is rendered as a sub-view inside
 * `AgentMessage` and dispatched directly via `useWorkflow().submitFeedback`.
 * The input area is always available and never enters a "feedback mode".
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { wrapClientUser, wrapDeveloperUser } from '../utils/user-tags';
import { useWorkflow } from './useWorkflow';

export function useUserInput() {
  const userMode = useAgentStore((s) => s.userMode);
  const stagedDeveloperMessage = useAgentStore((s) => s.stagedDeveloperMessage);
  const { submitMessage } = useWorkflow();

  /**
   * Submit composer content. The typed message is the app client's voice and
   * is wrapped as `<client_user>…</client_user>` unless it is already correctly
   * tagged. Developer-authored content can only enter the outgoing turn through
   * Insert, which stages a `<developer_user>…</developer_user>` block.
   */
  const submitUserInput = useCallback(async (message: string, libraryItemIds?: string[]) => {
    const hasLibraryItems = (libraryItemIds?.length ?? 0) > 0;
    // Typed text is the client's voice. wrapClientUser trims and skips wrapping
    // when the input is already correctly tagged. keepEmpty ensures an
    // attachment-only turn still carries a (possibly empty) client block.
    const userBlock = wrapClientUser(message, { keepEmpty: hasLibraryItems });

    if (stagedDeveloperMessage !== null) {
      const stagedBlock = wrapDeveloperUser(stagedDeveloperMessage);
      const combined = stagedBlock && userBlock
        ? `${stagedBlock}\n${userBlock}`
        : stagedBlock || userBlock;
      useAgentStore.getState().setStagedDeveloperMessage(null);
      if (combined) submitMessage(combined, libraryItemIds);
      return;
    }

    if (userBlock) {
      submitMessage(userBlock, libraryItemIds);
    }
  }, [stagedDeveloperMessage, submitMessage]);

  /**
   * Insert action (developer mode only) — stages the current input text as
   * developer-authored content without submitting. Trimmed so the staged
   * preview matches what is ultimately sent.
   */
  const insertDeveloperMessage = useCallback((text: string) => {
    useAgentStore.getState().setStagedDeveloperMessage(text.trim());
  }, []);

  return {
    submitUserInput,
    insertDeveloperMessage,
    userMode,
    stagedDeveloperMessage,
  };
}
