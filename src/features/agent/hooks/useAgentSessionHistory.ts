'use client';

/**
 * useAgentSessionHistory Hook
 * Fetches and caches session history using SWR via REST proxy
 */

import useSWR from 'swr';

export interface AgentSessionRow {
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

interface AgentSessionHistoryResponse {
  sessions: AgentSessionRow[];
  success: boolean;
}

const fetcher = async (url: string): Promise<AgentSessionHistoryResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

export function useAgentSessionHistory(limit: number = 100) {
  const { data, error, isLoading, mutate } = useSWR<AgentSessionHistoryResponse>(
    `/api/agent/sessions?limit=${limit}`,
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
