'use client';

/**
 * useSessionHistory Hook
 * Fetches and caches session history using SWR via REST proxy
 */

import useSWR from 'swr';
import { agentSWRKeys } from '../lib/swr-keys';

export interface SessionRow {
  id: string;
  title?: string;
  titleLocked?: boolean;
  agentName: string;
  eventCount: number;
  turnsCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface SessionHistoryResponse {
  sessions: SessionRow[];
  success: boolean;
}

const fetcher = async (url: string): Promise<SessionHistoryResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

export function useSessionHistory(limit: number = 100) {
  const { data, error, isLoading, mutate } = useSWR<SessionHistoryResponse>(
    agentSWRKeys.sessionHistory(limit),
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  return {
    sessions: data?.sessions || [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
