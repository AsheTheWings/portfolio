'use client';

/**
 * useAgentSessionRouting Hook
 * 
 * Syncs session ID between URL, localStorage, and store.
 * Handles initial load from URL or localStorage, and updates URL on session changes.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionLifecycle } from './useAgentSessionLifecycle';
import { loadCurrentAgentSessionId, saveCurrentAgentSessionId } from '../utils/agent-storage';

interface UseAgentSessionRoutingOptions {
  /** Session ID from URL (undefined if on base route) */
  urlSessionId?: string;
}

export function useAgentSessionRouting({ urlSessionId }: UseAgentSessionRoutingOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const { loadAgentSession } = useAgentSessionLifecycle();
  
  // Track if we've done initial resolution to prevent loops
  const initialResolvedRef = useRef(false);
  // Track last synced session to prevent redundant navigations
  const lastSyncedSessionRef = useRef<string | null>(null);
  // Track if component has mounted (for hydration safety)
  const mountedRef = useRef(false);

  /**
   * Navigate to session URL
   */
  const navigateToAgentSession = useCallback((sessionId: string | null) => {
    const targetPath = sessionId ? `/${sessionId}` : '/';
    if (pathname !== targetPath) {
      router.replace(targetPath);
    }
  }, [router, pathname]);

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
        // URL has session ID → load it if not already loaded
        if (currentSessionId !== urlSessionId) {
          try {
            await loadAgentSession(urlSessionId);
            saveCurrentAgentSessionId(urlSessionId);
            lastSyncedSessionRef.current = urlSessionId;
          } catch (error) {
            // Session doesn't exist or failed to load → redirect to base
            console.error('Failed to load session from URL:', error);
            saveCurrentAgentSessionId(null);
            navigateToAgentSession(null);
          }
        } else {
          // Already loaded, just sync refs
          saveCurrentAgentSessionId(urlSessionId);
          lastSyncedSessionRef.current = urlSessionId;
        }
      } else {
        // No URL session → check localStorage
        const storedId = loadCurrentAgentSessionId();
        if (storedId) {
          // Redirect to stored session
          lastSyncedSessionRef.current = storedId;
          navigateToAgentSession(storedId);
        }
      }
    };

    resolveSession();
  }, [urlSessionId, currentSessionId, loadAgentSession, navigateToAgentSession]);

  /**
   * Sync URL when store's currentSessionId changes (after initial resolution)
   */
  useEffect(() => {
    if (!mountedRef.current || !initialResolvedRef.current) return;
    
    // Skip if this is the same session we just synced
    if (currentSessionId === lastSyncedSessionRef.current) return;
    
    // Update localStorage and URL
    saveCurrentAgentSessionId(currentSessionId);
    lastSyncedSessionRef.current = currentSessionId;
    navigateToAgentSession(currentSessionId);
  }, [currentSessionId, navigateToAgentSession]);

  return {
    /** Session ID from URL (for initial load) */
    urlSessionId,
    /** Navigate to a specific session */
    navigateToAgentSession,
  };
}
