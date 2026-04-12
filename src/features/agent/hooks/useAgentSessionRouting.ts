'use client';

/**
 * useAgentSessionRouting Hook
 * 
 * Syncs session ID between URL, cookie, and store.
 * Server-side redirect handles `/` → `/<lastSessionId>` (reads cookie in page.tsx).
 * This hook handles URL → session loading and store → URL sync.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionLifecycle } from './useAgentSessionLifecycle';
import { useAgentConnection } from './useAgentConnection';
import { saveCurrentAgentSessionId } from '../utils/agent-storage';
import type { WireAgentSessionEvent } from '../types/protocol';

const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,36}$/;

interface UseAgentSessionRoutingOptions {
  /** Session ID from URL (undefined if on base route) */
  urlSessionId?: string;
  /** Server-fetched session events (SSR) — skips REST fetch */
  initialEvents?: WireAgentSessionEvent[] | null;
}

export function useAgentSessionRouting({ urlSessionId, initialEvents }: UseAgentSessionRoutingOptions = {}) {
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const { loadAgentSession } = useAgentSessionLifecycle();
  const { send } = useAgentConnection();
  
  // Track if we've done initial resolution to prevent loops
  const initialResolvedRef = useRef(false);
  // Track last synced session to prevent redundant navigations
  const lastSyncedSessionRef = useRef<string | null>(null);
  // Track if component has mounted (for hydration safety)
  const mountedRef = useRef(false);
  // Capture initial events in ref to avoid deps churn
  const initialEventsRef = useRef(initialEvents);

  /**
   * Navigate to session URL using history.replaceState to avoid
   * Next.js soft navigation (which remounts providers and drops WS).
   */
  const navigateToAgentSession = useCallback((sessionId: string | null) => {
    const targetPath = sessionId ? `/${sessionId}` : '/';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, []);

  /**
   * Initial resolution: URL → localStorage → store
   * Runs once after mount
   */
  useEffect(() => {
    if (initialResolvedRef.current) return;
    mountedRef.current = true;
    initialResolvedRef.current = true;

    const resolveSession = async () => {
      if (urlSessionId) {
        // Validate UUID format — non-UUID paths should not trigger session load
        if (!SESSION_ID_RE.test(urlSessionId)) {
          navigateToAgentSession(null);
          return;
        }
        // URL has session ID → load it if not already loaded
        if (currentSessionId !== urlSessionId) {
          try {
            await loadAgentSession(urlSessionId, initialEventsRef.current ?? undefined);
            saveCurrentAgentSessionId(urlSessionId);
            lastSyncedSessionRef.current = urlSessionId;
          } catch (error) {
            // Session doesn't exist or failed to load → redirect to base
            console.error('Failed to load session from URL:', error);
            saveCurrentAgentSessionId(null);
            navigateToAgentSession(null);
          }
        } else {
          // Already loaded, just sync refs and re-subscribe.
          // After a provider remount the WS connection is new and has no
          // subscriptions, so we must explicitly subscribe to keep
          // receiving session events from the backend.
          saveCurrentAgentSessionId(urlSessionId);
          lastSyncedSessionRef.current = urlSessionId;
          send({ type: 'subscribe', sessionId: urlSessionId });
        }
      }
      // No URL session on base route → server redirect handles this via cookie.
      // Nothing to do client-side.
    };

    resolveSession();
  }, [urlSessionId, currentSessionId, loadAgentSession, navigateToAgentSession, send]);

  /**
   * Sync URL when store's currentSessionId changes (after initial resolution)
   */
  useEffect(() => {
    if (!mountedRef.current || !initialResolvedRef.current) return;
    
    // Skip if this is the same session we just synced
    if (currentSessionId === lastSyncedSessionRef.current) return;
    
    // Update localStorage
    saveCurrentAgentSessionId(currentSessionId);
    lastSyncedSessionRef.current = currentSessionId;

    // Only navigate when we have a session to navigate to.
    // Navigating to '/' when currentSessionId is null causes a page transition
    // that remounts AgentConnectionProvider, destroying the WS connection.
    // When the user sends the next message the backend will create a new session
    // and session_created will update the URL via this same effect.
    if (currentSessionId) {
      navigateToAgentSession(currentSessionId);
    } else {
      navigateToAgentSession(null);
    }
  }, [currentSessionId, navigateToAgentSession]);

  return {
    /** Session ID from URL (for initial load) */
    urlSessionId,
    /** Navigate to a specific session */
    navigateToAgentSession,
  };
}
