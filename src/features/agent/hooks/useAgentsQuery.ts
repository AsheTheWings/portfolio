'use client';

/**
 * useAgentsQuery — SWR-based hook for agents list with avatar polling.
 *
 * Polls at a short interval while any agent is missing avatar images,
 * then stops polling once all avatars are loaded (or no agents exist).
 */

import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchAgents, type SavedAgent } from '../lib/agent-api';

const AGENTS_SWR_KEY = '/api/agent/agents';
const AVATAR_POLL_INTERVAL_MS = 3_000;

async function fetcher(): Promise<SavedAgent[]> {
  return fetchAgents();
}

export function useAgentsQuery() {
  const { data: agents = [], error, isLoading, isValidating, mutate } = useSWR<SavedAgent[]>(
    AGENTS_SWR_KEY,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2_000,
      keepPreviousData: true,
    },
  );

  // Detect agents with pending avatars
  const hasPendingAvatars = useMemo(
    () => agents.some((a) => !a.avatarImage),
    [agents],
  );

  // Poll while avatars are still generating
  useSWR(
    hasPendingAvatars ? `${AGENTS_SWR_KEY}:poll` : null,
    fetcher,
    {
      refreshInterval: AVATAR_POLL_INTERVAL_MS,
      onSuccess: (freshAgents) => {
        // Update the main cache with polled data
        mutate(freshAgents, { revalidate: false });
      },
    },
  );

  return {
    agents,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    mutate,
    hasPendingAvatars,
  };
}

/** SWR key for external mutate calls (e.g. after create/delete). */
export { AGENTS_SWR_KEY };
