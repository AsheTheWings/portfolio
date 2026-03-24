'use client';

/**
 * useSessionLifecycle Hook
 * 
 * Single Responsibility: Session instance lifecycle management
 * - Create new sessions
 * - Load existing sessions (and their components)
 * - Clear sessions
 */

import { useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { toSessionComponents } from '../utils/toSessionComponent';
import { saveCurrentSessionId } from '../utils/agent-storage';
import type { SessionMetadata, SessionEvent } from '../types';

export function useSessionLifecycle() {
  const upsertComponent = useAgentStore((s) => s.upsertComponent);

  /**
   * Create new session
   * sessionsManager handles API call and server-side ID generation
   */
  const createSession = useCallback(
    async (metadata?: Partial<SessionMetadata>) => {
      const store = useAgentStore.getState();
      
      // Stop any running agent loop before creating new session
      store.stopAgent();
      
      try {
        store.setError(null);
        store.clearComponents();

        // Create session via sessionsManager (handles API call + server ID generation)
        const sessionsManager = store.sessionsManager;
        const persistSession = store.persistSession;
        const ephemeral = store.ephemeral;
        
        const session = await sessionsManager.createSession(
          metadata || {},
          { persist: persistSession, ephemeral }
        );
        
        const newSessionId = session.getSessionId()!;
        
        // Set current session and persist to localStorage
        store.setCurrentSessionId(newSessionId);
        saveCurrentSessionId(newSessionId);

        return newSessionId;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to create session';
        useAgentStore.getState().setError(errorMessage);
        console.error('❌ Failed to create session:', e);
        throw e;
      }
    },
    []
  );

  /**
   * Load existing session (instance + components)
   */
  const loadSession = useCallback(
    async (sessionId: string) => {
      const store = useAgentStore.getState();
      
      // Stop any running agent loop before loading session
      store.stopAgent();
      
      try {
        store.setError(null);

        // Load session instance via sessionsManager (returns events)
        const sessionsManager = store.sessionsManager;
        const persistSession = store.persistSession;
        const ephemeral = store.ephemeral;
        
        // Load session - sessionsManager returns restored config and events
        const { session: session, restoredConfig, events } = await sessionsManager.loadSession(
          sessionId,
          { persist: persistSession, ephemeral }
        );
        
        // Update store with restored config if available
        if (restoredConfig) {
          store.setAgentConfig(restoredConfig);
        }
        
        // Set current session and persist to localStorage
        store.setCurrentSessionId(sessionId);
        saveCurrentSessionId(sessionId);

        // Clear old components and exit feedback mode
        store.clearComponents();
        store.setActiveFeedbackRequest(null);
        
        // Extract last 20 user messages for history navigation
        const userMessages = events
          .filter((e: SessionEvent) => e.type === 'user-turn-completed' && (e.data as { message?: string }).message)
          .map((e: SessionEvent) => (e.data as { message?: string }).message)
          .filter((m): m is string => typeof m === 'string')
          .reverse() // Most recent first
          .slice(0, 20);
        store.setUserMessagesHistory(userMessages);
        
        // Build components from events (historical mode)
        for (const event of events) {
          upsertComponent(toSessionComponents(event));
        }
        
        // Check if agent turn is incomplete after loading
        // Handled by useConversationStatus hook automatically
        // when currentSessionId changes

        return { sessionId, metadata: session.getMetadata() };
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load session';
        useAgentStore.getState().setError(errorMessage);
        console.error('❌ Failed to load session:', e);
        throw e;
      }
    },
    []
  );

  /**
   * Clear current session
   */
  const clearSession = useCallback(() => {
    const store = useAgentStore.getState();
    
    // Stop any running agent loop before clearing session
    store.stopAgent();
    
    if (store.currentSessionId) {
      store.sessionsManager.deleteSession(store.currentSessionId);
    }
    
    store.setCurrentSessionId(null);
    store.clearComponents();
    store.clearUserMessagesHistory();
    store.setActiveFeedbackRequest(null);
    store.selectJob(null);
    saveCurrentSessionId(null);
  }, []);

  return {
    createSession,    // Create new session instance
    loadSession,      // Load existing session instance
    clearSession,     // Clear current session
  };
}
