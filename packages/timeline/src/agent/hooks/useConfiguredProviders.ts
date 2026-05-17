'use client';

/**
 * useConfiguredProviders Hook
 *
 * SWR-backed cache for provider API-key presence. This fetches only provider
 * identifiers, never secret key values, and shares/dedupes state across panels.
 */

import useSWR from 'swr';
import { httpClient } from '@portfolio/api-client';
import { agentSWRKeys } from '../lib/swr-keys';

interface ConfiguredProvidersResponse {
  configured: string[];
}

async function fetchConfiguredProviders(): Promise<string[]> {
  const data = await httpClient.get<ConfiguredProvidersResponse>(agentSWRKeys.configuredProviders);
  return data.configured;
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
