'use client';

/**
 * useSessionHistory Hook
 * Fetches and caches session history using SWR
 * Provides automatic revalidation and background updates
 * Starts fetching as soon as store is ready
 */

import { useEffect } from 'react';
import useSWR from 'swr';
import { useAgentStore } from '../stores/useAgentStore';

export interface SessionRow {
  id: string;
  title?: string;
  title_locked?: boolean;
  agent_name: string;
  event_count: number;
  turns_count: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface SessionHistoryResponse {
  sessions: SessionRow[];
  success: boolean;
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<SessionHistoryResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

/**
 * Hook to fetch and cache session history
 * Starts fetching as soon as store is ready
 * 
 * @param limit - Maximum number of sessions to fetch (default: 100)
 * @returns Session data with SWR states
 */
export function useSessionHistory(limit: number = 100) {
  const sessionsManager = useAgentStore(state => state.sessionsManager);
  
  const { data, error, isLoading, mutate } = useSWR<SessionHistoryResponse>(
    sessionsManager ? `/api/agent/sessions?limit=${limit}` : null,
    fetcher,
    {
      // Revalidate every 30 seconds
      refreshInterval: 30000,
      
      // Revalidate when window regains focus
      revalidateOnFocus: true,
      
      // Dedupe requests within 5 seconds
      dedupingInterval: 5000,
      
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  );

  // Trigger initial fetch when store becomes ready
  useEffect(() => {
    if (sessionsManager) {
      mutate();
    }
  }, [sessionsManager, mutate]);

  return {
    sessions: data?.sessions || [],
    isLoading,
    isError: !!error,
    error,
    mutate, // Manual refresh function
  };
}
