'use client';

/**
 * useAssets - SWR-based hook for fetching assets
 * Provides caching, revalidation, and automatic refetching
 */

import useSWR from 'swr';
import { useEffect, useMemo } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Asset, ListAssetsParams } from '../types';
import { agentimeHttp } from '../../agent/lib/agentime-client';

/**
 * Build query string from params (no pagination params - client-side)
 */
function buildQueryString(params: ListAssetsParams): string {
  const searchParams = new URLSearchParams();
  if (params.folderId) searchParams.set('folderId', params.folderId);
  if (params.fileType) searchParams.set('fileType', params.fileType);
  if (params.tag) searchParams.set('tag', params.tag);
  if (params.search) searchParams.set('search', params.search);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  return searchParams.toString();
}

/**
 * Fetcher function for SWR
 */
/**
 * Hook for fetching assets with SWR
 * Syncs data to Zustand store for global access
 */
export function useAssets(params?: Partial<ListAssetsParams>) {
  const filters = useLibraryStore((state) => state.filters);
  const setAssets = useLibraryStore((state) => state.setAssets);
  const setLoading = useLibraryStore((state) => state.setLoading);
  const setError = useLibraryStore((state) => state.setError);

  // Merge params with store filters
  const queryParams = useMemo(() => ({
    ...filters,
    ...params,
  }), [filters, params]);

  // Build SWR key
  const swrKey = useMemo(() => {
    return `agentime:library:assets:${buildQueryString(queryParams)}`;
  }, [queryParams]);

  // SWR fetch
  const { data, error, isLoading, isValidating, mutate } = useSWR<Asset[]>(
    swrKey,
    () => agentimeHttp.listLibraryAssets({
      ...(queryParams.folderId ? { folderId: queryParams.folderId } : {}),
      ...(queryParams.search ? { search: queryParams.search } : {}),
      limit: 100,
    }),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      keepPreviousData: false, // Don't show old folder's data while fetching new folder
    }
  );

  // Sync to Zustand store
  const assets = useMemo(() => (data ?? []).filter((asset) =>
    (!queryParams.fileType || asset.fileType === queryParams.fileType)
    && (!queryParams.tag || asset.tags.includes(queryParams.tag))), [
    data,
    queryParams.fileType,
    queryParams.tag,
  ]);

  useEffect(() => {
    if (data) setAssets(assets, assets.length);
  }, [assets, data, setAssets]);

  // Sync loading state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Sync error state
  useEffect(() => {
    if (error) {
      setError(error.message);
    }
  }, [error, setError]);

  return {
    // Data
    assets,
    total: assets.length,
    
    // Status
    isLoading,
    isValidating,
    error: error?.message ?? null,
    
    // Actions
    mutate,
    refresh: () => mutate(),
  };
}
