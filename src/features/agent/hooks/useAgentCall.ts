'use client';

/**
 * useAgentCall Hook
 * 
 * Single Responsibility: Live agent execution with streaming
 * - callAgent(): Send user message and run agent loop
 * - resumeAgent(): Continue agent loop without new user input
 * - Uses toSessionComponents for pure event-to-component conversion
 * - RAF-gated streaming buffer: batches model-message-chunk and model-thought-chunk
 *   updates to at most one Zustand set() per animation frame (~60fps), dramatically
 *   reducing re-renders at high token speeds (80–120 tokens/sec).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useSessionLifecycle } from './useSessionLifecycle';
import { useToolEffects } from './useToolEffects';
import { toSessionComponents } from '../utils/toSessionComponent';
import type { Session } from '../core/session';
import type { SessionComponent } from '../types';

type StreamBufferEntry = {
  latestComponent: SessionComponent;
  accMessage: string;   // accumulated message delta since last RAF flush
  accThoughts: string;  // accumulated thoughts delta since last RAF flush
};

/**
 * Hook for streaming live agent calls
 */
export function useAgentCall() {
  const { createSession } = useSessionLifecycle();
  const handleToolEffects = useToolEffects();
  const upsertComponent = useAgentStore((s) => s.upsertComponent);

  // RAF streaming buffer: chunk events are merged here between animation frames
  const streamBufferRef = useRef<Map<string, StreamBufferEntry>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  // Swap-and-flush: replaces the buffer map to let new chunks accumulate immediately
  const flushStreamBuffer = useCallback(() => {
    rafIdRef.current = null;
    if (streamBufferRef.current.size === 0) return;

    const bufferToFlush = streamBufferRef.current;
    streamBufferRef.current = new Map();

    const toFlush: SessionComponent[] = [];
    for (const [, entry] of bufferToFlush) {
      toFlush.push({
        ...entry.latestComponent,
        data: {
          ...entry.latestComponent.data,
          ...(entry.accMessage !== '' ? { message: entry.accMessage } : {}),
          ...(entry.accThoughts !== '' ? { thoughts: entry.accThoughts } : {}),
        },
      });
    }
    upsertComponent(toFlush);
  }, [upsertComponent]);

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushStreamBuffer);
    }
  }, [flushStreamBuffer]);

  /** Accumulate a streaming chunk into the buffer and schedule a RAF flush */
  const bufferStreamChunk = useCallback((components: SessionComponent[]) => {
    const buffer = streamBufferRef.current;
    for (const component of components) {
      const existing = buffer.get(component.id);
      if (existing) {
        existing.accMessage += component.data.message ?? '';
        existing.accThoughts += component.data.thoughts ?? '';
        existing.latestComponent = component;
      } else {
        buffer.set(component.id, {
          latestComponent: component,
          accMessage: component.data.message ?? '',
          accThoughts: component.data.thoughts ?? '',
        });
      }
    }
    scheduleFlush();
  }, [scheduleFlush]);

  /** Cancel pending RAF and flush synchronously — used before non-chunk events and at loop end */
  const cancelAndFlushStreamBuffer = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushStreamBuffer();
  }, [flushStreamBuffer]);

  // Cancel any pending RAF on unmount to prevent state updates on dead components
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const executeAgentLoop = useCallback(async (
    session: Session,
    emitUserTurn: boolean,
    userMessage?: string,
    libraryItemIds?: string[]
  ) => {
    const store = useAgentStore.getState();

    // Reset streaming buffer in case a previous loop left residue
    streamBufferRef.current.clear();
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // Create new abort controller for this execution and store it globally
    const abortController = new AbortController();
    store.setAbortController(abortController);
    const signal = abortController.signal;

    try {
      // Set processing state - agent loop started
      store.setConversationStatus('processing');
      
      // Emit user turn if requested (message or library items)
      const hasUserContent = userMessage || (libraryItemIds && libraryItemIds.length > 0);
      if (emitUserTurn && hasUserContent) {
        // Clear system panels when user sends a new message
        store.removeComponentsByRole('system');
        
        // setUserTurn may yield finalization events before the user turn event
        // Pass current config to capture it in the event (store guarantees agentConfig exists)
        for await (const event of session.setUserTurn(userMessage || '', store.agentConfig!, libraryItemIds)) {
          upsertComponent(toSessionComponents(event));
          
          if (event.type === 'user-turn-completed' && userMessage) {
            store.appendToUserMessagesHistory(userMessage);
          }
        }
      }

      // Stream agent events from session
      for await (const event of session.callAgent(signal)) {
        // Update conversation status based on event type
        if (event.type === 'model-thought-chunk') {
          store.setConversationStatus('thinking');
        } else if (event.type === 'model-message-chunk') {
          store.setConversationStatus('responding');
        } else if (event.type === 'tool-call') {
          store.setConversationStatus('toolCalling');
        } else if (event.type === 'tool-result') {
          store.setConversationStatus('processing');
        }
        
        // Handle tool-effects events (UI effects, userActions triggers stopAgent)
        if (event.type === 'tool-effects') {
          handleToolEffects(event);
        }
        
        // RAF-gate streaming chunks: buffer message/thought deltas, flush at most once per frame.
        // Non-chunk events flush the buffer synchronously first to guarantee render ordering.
        if (event.type === 'model-message-chunk' || event.type === 'model-thought-chunk') {
          bufferStreamChunk(toSessionComponents(event));
        } else {
          cancelAndFlushStreamBuffer();
          upsertComponent(toSessionComponents(event));
        }
        
        // Check if execution was aborted (includes userActions triggering stopAgent)
        if (signal.aborted) {
          break;
        }
      }

      // Flush any remaining buffered chunks after the stream ends
      cancelAndFlushStreamBuffer();

      store.setConversationStatus('healthy');
      
      // Checkpoint: Await session's persistence promise
      const checkpointResult = await session.checkpoint();
      if (!checkpointResult.success) {
        console.warn('⚠️ Checkpoint failed:', checkpointResult.error);
      }
      
    } catch (error: any) {
      // Abort errors are expected when user clicks stop
      if (error.name === 'AbortError') {
        console.log('🛑 Agent loop aborted by user');
      } else {
        console.warn('❌ Agent loop error:', error);
      }
      store.setConversationStatus('healthy');
    }
    
    // Clear abort controller after agent loop completes
    store.setAbortController(null);

  }, [upsertComponent, handleToolEffects, bufferStreamChunk, cancelAndFlushStreamBuffer]);

  /**
   * Send user message and run agent loop
   * Auto-creates session if none exists
   * 
   * @param userMessage - User message to send
   * @param libraryItemIds - Optional library item IDs (assets or folders) to attach
   */
  const callAgent = useCallback(async (
    userMessage: string,
    libraryItemIds?: string[]
  ) => {
    const store = useAgentStore.getState();
    let activeSession = store.getCurrentSession();
    
    // Auto-create session if none exists
    if (!activeSession) {
      try {
        await createSession();
        activeSession = store.getCurrentSession();
        if (!activeSession) {
          console.error('❌ Session creation succeeded but session is not available in store');
          return;
        }
      } catch (error) {
        console.error('❌ Failed to create session:', error instanceof Error ? error.message : 'Unknown error');
        return;
      }
    }

    await executeAgentLoop(activeSession, true, userMessage, libraryItemIds);
  }, [createSession, executeAgentLoop]);

  /**
   * Resume agent loop without emitting user turn
   * Used after feedback submission or to continue interrupted execution
   * Requires active session
   */
  const resumeAgent = useCallback(async () => {
    const store = useAgentStore.getState();
    const activeSession = store.getCurrentSession();
    
    if (!activeSession) {
      console.error('❌ Cannot resume: No active session');
      return;
    }

    // remove incomplete agent components from UI before resuming
    if (activeSession.hasBufferedContent()) {
      const components = store.sessionComponents;
      const len = components.length;
      const idsToRemove: string[] = [];
      
      if (len > 0 && components[len - 1].role === 'agent' &&
        (components[len - 1].type === 'agent-thoughts'
          || components[len - 1].type === 'message')) {
        idsToRemove.push(components[len - 1].id);
        if (len > 1 && components[len - 2].role === 'agent' && components[len - 2].type === 'agent-thoughts') {
          idsToRemove.push(components[len - 2].id);
        }
      }
    
      if (idsToRemove.length) {
        store.setSessionComponents(
          components.filter(c => !idsToRemove.includes(c.id))
        );
      }
    }

    await executeAgentLoop(activeSession, false);
  }, [executeAgentLoop]);

  /**
   * Stop current agent execution immediately
   */
  const stopAgent = useCallback(() => {
    useAgentStore.getState().stopAgent();
  }, []);

  return {
    callAgent,
    resumeAgent,
    stopAgent,
  };
}
