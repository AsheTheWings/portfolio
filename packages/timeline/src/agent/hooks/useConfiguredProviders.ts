'use client';

/**
 * useConfiguredProviders Hook
 *
 * SWR-backed cache for provider API-key presence. This fetches only provider
 * identifiers, never secret key values, and shares/dedupes state across panels.
 */

import useSWR from 'swr';
import { agentimeHttp } from '../lib/agentime-client';
import { agentSWRKeys } from '../lib/swr-keys';
import { withHttpProblem } from '../problems/http';

async function fetchConfiguredProviders(): Promise<string[]> {
  return (await withHttpProblem(
    () => agentimeHttp.listCredentials(),
    'credential',
    'credentials-list',
  )).map((credential) => credential.provider);
}

export function useConfiguredProviders() {
  const { data = [], error, isLoading, isValidating, mutate } = useSWR<string[]>(
    agentSWRKeys.configuredProviders,
    fetchConfiguredProviders,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );

  return {
    configuredProviders: new Set(data),
    configuredProviderIds: data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
