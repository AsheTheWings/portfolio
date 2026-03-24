'use client';

/**
 * useConversationStatus Hook
 * 
 * Single Responsibility: Monitor conversation status and lifecycle state
 * - Detects processing state (thinking, toolCalling, responding)
 * - Detects interrupted agent turns
 * - Detects hanging user inputs
 * - Detects feedback wait states
 */

import { useEffect } from 'react';
import { useAgentStore } from '../stores/useAgentStore';

export type ConversationStatus = 
  | 'healthy'          // Normal idle state
  | 'processing'       // Agent loop started, waiting for first event
  | 'thinking'         // Agent generating thoughts
  | 'toolCalling'      // Agent executing tools
  | 'responding'       // Agent generating response
  | 'waitingFeedback'  // Agent waiting for user feedback
  | 'hangingInput'     // User message sent but not processing
  | 'interrupted';     // Agent turn incomplete

/**
 * Hook to monitor conversation status
 * Updates store with current status based on session state
 * Note: Processing states (processing, thinking, toolCalling, responding) are set by useAgentCall
 */
export function useConversationStatus() {
  const conversationStatus = useAgentStore((state) => state.conversationStatus);
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const activeFeedbackRequest = useAgentStore((state) => state.activeFeedbackRequest);
  const getCurrentSession = useAgentStore((state) => state.getCurrentSession);
  const setConversationStatus = useAgentStore((state) => state.setConversationStatus);
  const setActiveFeedbackRequest = useAgentStore((state) => state.setActiveFeedbackRequest);
  
  useEffect(() => {
    // 1. Processing States - skip if already in a processing state
    // (these are set explicitly by useAgentCall)
    if (conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding') {
      return;
    }
    
    const session = getCurrentSession();
    
    if (!session) {
      setConversationStatus('healthy');
      return;
    }
    
    // Get events to check specific edge cases
    const events = session.getEvents();
    const lastEvent = [...events].reverse().find(e => e.role !== 'system') || null;
    
    if (!lastEvent) {
      setConversationStatus('healthy');
      return;
    }

    // 2. Hanging User Message
    if (lastEvent.type === 'user-turn-completed' && !session.hasBufferedContent()) {
      setConversationStatus('hangingInput');
      return;
    }

    // 3. Feedback Mode (tool-effects with userActions waiting for user)
    if (lastEvent.type === 'tool-effects') {
      const toolEffects = (lastEvent.data as any).toolEffects || {};
      if (toolEffects.userActions) {
        setConversationStatus('waitingFeedback');
        // Set activeFeedbackRequest if not already set
        if (!activeFeedbackRequest) {
          setActiveFeedbackRequest({
            componentId: lastEvent.componentId,
            userActions: { [toolEffects.userActions.prompt]: toolEffects.userActions.actions },
          });
        }
        return;
      }
    }

    // 4. Interrupted Agent Turn
    if (!session.isAgentTurnCompleted()) {
      setConversationStatus('interrupted');
      return;
    }
    
    // 5. Healthy (Idle)
    setConversationStatus('healthy');
    
  }, [conversationStatus, currentSessionId, activeFeedbackRequest, getCurrentSession, setConversationStatus, setActiveFeedbackRequest]);
}
