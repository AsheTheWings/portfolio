'use client';

/**
 * useAcquiredAgentsQuery — SWR-based hook for the user's acquired agents.
 *
 * Fetches owned + explicitly acquired public agents.
 * Pushes results into the Zustand store (single source of truth).
 * Should be called at page level so agents are available on load.
 */

import useSWR, { mutate as swrMutate } from 'swr';
import { agentimeHttp } from '../lib/agentime-client';
import type { SavedAgent } from '../types';
import { useAgentStore } from '../stores/useAgentStore';
import { agentSWRKeys } from '../lib/swr-keys';
import { withHttpProblem } from '../problems/http';

/**
 * Trigger a revalidation of the acquired agents cache.
 * Call after mutations (acquire, release, delete) to refresh the store.
 */
export function revalidateAcquiredAgents(): void {
  swrMutate(agentSWRKeys.acquiredAgents);
}

async function fetcher(): Promise<SavedAgent[]> {
  return withHttpProblem(
    () => agentimeHttp.listAcquiredAgents(),
    'agent',
    'acquired-agents',
  );
}

export function useAcquiredAgentsQuery() {
  const setAcquiredAgents = useAgentStore((s) => s.setAcquiredAgents);

  const { data: agents = [], error, isLoading, isValidating, mutate } = useSWR<SavedAgent[]>(
    agentSWRKeys.acquiredAgents,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
      onSuccess: (data) => {
        setAcquiredAgents(data);
      },
    },
  );

  return {
    agents,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
