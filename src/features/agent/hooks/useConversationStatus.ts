'use client';

/**
 * useConversationStatus Hook
 * 
 * Conversation status is now driven by WS events via useWsEventIngestion.
 * This hook re-exports the type and provides a convenience selector.
 */

import { useAgentStore } from '../stores/useAgentStore';

export type ConversationStatus = 
  | 'healthy'
  | 'processing'
  | 'thinking'
  | 'toolCalling'
  | 'responding'
  | 'waitingFeedback'
  | 'hangingInput'
  | 'interrupted';

/**
 * Convenience hook for reading conversation status from store
 */
export function useConversationStatus(): ConversationStatus {
  return useAgentStore((state) => state.conversationStatus);
}
