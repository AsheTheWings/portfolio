'use client';

/**
 * useFoldersQuery - SWR-based hook for folder revalidation
 * Works alongside server-side hydration to keep folders fresh
 * 
 * Design:
 * - Server hydrates folders on initial page load (instant navigation)
 * - SWR revalidates on tab focus to catch changes from other tabs/sessions
 * - Store remains source of truth for navigation
 */

import useSWR from 'swr';
import { useEffect } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Folder } from '../types';
import { agentimeHttp } from '../../agent/lib/agentime-client';

/**
 * Hook for folder revalidation with SWR
 * Syncs data to Zustand store for global access
 */
export function useFoldersQuery() {
  const hydrateAllFolders = useLibraryStore((state) => state.hydrateAllFolders);
  const isLoadingFolders = useLibraryStore((state) => state.isLoadingFolders);
  const allFolders = useLibraryStore((state) => state.allFolders);

  // SWR fetch - only revalidates, doesn't block initial render
  const { data, error, isValidating, mutate } = useSWR<Folder[]>(
    'agentime:library:folders',
    () => agentimeHttp.listLibraryFolders(),
    {
      // Don't fetch on mount if already hydrated from server
      revalidateOnMount: allFolders.length === 0,
      // Revalidate when user returns to tab
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Avoid duplicate requests
      dedupingInterval: 5000,
      // Keep showing current data while revalidating
      keepPreviousData: true,
      // Don't show loading state for background revalidation
      revalidateIfStale: true,
    }
  );

  // Sync to Zustand store when SWR fetches new data
  useEffect(() => {
    if (data?.length) {
      hydrateAllFolders(data);
    }
  }, [data, hydrateAllFolders]);

  return {
    // Data from store (source of truth)
    folders: allFolders,
    
    // Status
    isLoading: isLoadingFolders,
    isValidating,
    error: error?.message ?? null,
    
    // Actions
    mutate,
    revalidate: () => mutate(),
  };
}
