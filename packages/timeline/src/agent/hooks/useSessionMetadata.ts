'use client';

/**
 * useSessionMetadata Hook
 * Manages single session metadata with debounced auto-save
 * Provides turn count, event count, and editable fields
 */

import { useRef, useCallback, useMemo } from 'react';
import { mutate } from 'swr';
import { useSessionHistory } from './useSessionHistory';
import { agentSWRKeys } from '../lib/swr-keys';

export interface SessionMetadata {
  id: string;
  title: string | null;
  titleLocked: boolean;
  agentName: string;
  turnCount: number;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UseSessionMetadataReturn {
  // Data
  metadata: SessionMetadata | null;
  isLoading: boolean;
  isError: boolean;
  
  // Actions (debounced automatically)
  updateTitle: (title: string) => void;
  updateTitleLocked: (locked: boolean) => void;
}

/**
 * Hook to manage session metadata with debounced auto-save
 * 
 * @param sessionId - The session ID to fetch metadata for
 * @returns Session metadata and update functions
 */
export function useSessionMetadata(sessionId?: string): UseSessionMetadataReturn {
  // Debounce timers
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch sessions list (includes all metadata)
  const { sessions, isLoading, isError } = useSessionHistory(100);
  
  // Find the specific session from the list
  const data = useMemo(() => {
    if (!sessionId) return null;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    
    return {
      id: session.id,
      title: session.title || null,
      titleLocked: session.titleLocked || false,
      agentName: session.agentName ?? 'Assistant',
      turnCount: session.interactionsCount,
      eventCount: session.eventCount,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }, [sessionId, sessions]);

  // Save metadata to database
  const saveMetadataToDB = useCallback(async (
    sessionId: string, 
    updates: { title?: string; agentName?: string; titleLocked?: boolean }
  ) => {
    try {
      const { agentimeHttp } = await import('../lib/agentime-client');
      const canonical = {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.titleLocked !== undefined ? { titleLocked: updates.titleLocked } : {}),
      };
      if (Object.keys(canonical).length) await agentimeHttp.updateSession(sessionId, canonical);
      mutate(agentSWRKeys.sessionHistory(100));
    } catch (err) {
      console.error('Failed to save metadata:', err);
    }
  }, []);

  // Debounced title update (1500ms)
  const updateTitle = useCallback((title: string) => {
    if (!sessionId) return;
    
    // Clear existing timeout
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }
    
    // Set new timeout
    titleDebounceRef.current = setTimeout(() => {
      saveMetadataToDB(sessionId, { 
        title, 
        titleLocked: true  // Lock title to prevent auto-generation
      });
    }, 1500);
  }, [sessionId, saveMetadataToDB]);

  // Update title locked status (no debounce - immediate save)
  const updateTitleLocked = useCallback((locked: boolean) => {
    if (!sessionId) return;
    saveMetadataToDB(sessionId, { titleLocked: locked });
  }, [sessionId, saveMetadataToDB]);

  return {
    metadata: data,
    isLoading,
    isError,
    updateTitle,
    updateTitleLocked,
  };
}
