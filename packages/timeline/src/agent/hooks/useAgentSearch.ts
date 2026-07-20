'use client';

/**
 * useAgentSearch — Lazy SWR hook for discovering agents by name/description.
 *
 * Searches owned + public agents via the backend search endpoint.
 * Only fetches when a non-empty query is provided (lazy activation).
 * Used by AgentsHub for the search/discovery feature.
 */

import useSWR from 'swr';
import { agentimeHttp } from '../lib/agentime-client';
import type { SavedAgent } from '../types';
import { agentSWRKeys } from '../lib/swr-keys';
import { withHttpProblem } from '../problems/http';

function buildKey(query: string | null): string | null {
  if (!query || query.trim().length === 0) return null;
  return agentSWRKeys.agentSearch(query);
}

export function useAgentSearch(query: string | null) {
  const { data: results = [], error, isLoading, isValidating } = useSWR<SavedAgent[]>(
    buildKey(query),
    () => withHttpProblem(
      () => agentimeHttp.searchAgents({ query: query!.trim() }),
      'agent',
      'agent-search',
    ),
    {
      dedupingInterval: 1_000,
      keepPreviousData: true,
    },
  );

  return {
    results,
    error: error?.message ?? null,
    isSearching: isLoading || isValidating,
  };
}
