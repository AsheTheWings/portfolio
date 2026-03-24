'use client';

/**
 * useSessionMetadata Hook
 * Manages single session metadata with debounced auto-save
 * Provides turn count, event count, and editable fields
 */

import { useRef, useCallback, useMemo } from 'react';
import { mutate } from 'swr';
import { useSessionHistory } from './useSessionHistory';

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
  updateAgentName: (name: string) => void;
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
  const agentNameDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
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
      titleLocked: session.title_locked || false,
      agentName: session.agent_name,
      turnCount: session.turns_count,
      eventCount: session.event_count,
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
      const response = await fetch(`/api/agent/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        // Trigger cache revalidation for sessions list
        mutate('/api/agent/sessions?limit=100');
      }
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

  // Debounced agent name update (1500ms)
  const updateAgentName = useCallback((agentName: string) => {
    if (!sessionId) return;
    
    // Clear existing timeout
    if (agentNameDebounceRef.current) {
      clearTimeout(agentNameDebounceRef.current);
    }
    
    // Set new timeout
    agentNameDebounceRef.current = setTimeout(() => {
      saveMetadataToDB(sessionId, { agentName });
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
    updateAgentName,
    updateTitleLocked,
  };
}
