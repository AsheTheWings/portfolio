'use client';

/**
 * useSessionRouting Hook
 * 
 * Syncs session ID between URL, localStorage, and store.
 * Handles initial load from URL or localStorage, and updates URL on session changes.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAgentStore } from '../stores/useAgentStore';
import { useSessionLifecycle } from './useSessionLifecycle';
import { loadCurrentSessionId, saveCurrentSessionId } from '../utils/agent-storage';

const BASE_PATH = '/agent-playground';

interface UseSessionRoutingOptions {
  /** Session ID from URL (undefined if on base route) */
  urlSessionId?: string;
}

export function useSessionRouting({ urlSessionId }: UseSessionRoutingOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const { loadSession } = useSessionLifecycle();
  
  // Track if we've done initial resolution to prevent loops
  const initialResolvedRef = useRef(false);
  // Track last synced session to prevent redundant navigations
  const lastSyncedSessionRef = useRef<string | null>(null);
  // Track if component has mounted (for hydration safety)
  const mountedRef = useRef(false);

  /**
   * Navigate to session URL
   */
  const navigateToSession = useCallback((sessionId: string | null) => {
    const targetPath = sessionId ? `${BASE_PATH}/${sessionId}` : BASE_PATH;
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
            await loadSession(urlSessionId);
            saveCurrentSessionId(urlSessionId);
            lastSyncedSessionRef.current = urlSessionId;
          } catch (error) {
            // Session doesn't exist or failed to load → redirect to base
            console.error('Failed to load session from URL:', error);
            saveCurrentSessionId(null);
            navigateToSession(null);
          }
        } else {
          // Already loaded, just sync refs
          saveCurrentSessionId(urlSessionId);
          lastSyncedSessionRef.current = urlSessionId;
        }
      } else {
        // No URL session → check localStorage
        const storedId = loadCurrentSessionId();
        if (storedId) {
          // Redirect to stored session
          lastSyncedSessionRef.current = storedId;
          navigateToSession(storedId);
        }
      }
    };

    resolveSession();
  }, [urlSessionId, currentSessionId, loadSession, navigateToSession]);

  /**
   * Sync URL when store's currentSessionId changes (after initial resolution)
   */
  useEffect(() => {
    if (!mountedRef.current || !initialResolvedRef.current) return;
    
    // Skip if this is the same session we just synced
    if (currentSessionId === lastSyncedSessionRef.current) return;
    
    // Update localStorage and URL
    saveCurrentSessionId(currentSessionId);
    lastSyncedSessionRef.current = currentSessionId;
    navigateToSession(currentSessionId);
  }, [currentSessionId, navigateToSession]);

  return {
    /** Session ID from URL (for initial load) */
    urlSessionId,
    /** Navigate to a specific session */
    navigateToSession,
  };
}
