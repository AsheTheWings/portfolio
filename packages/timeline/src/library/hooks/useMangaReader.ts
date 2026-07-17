'use client';

/**
 * useMangaReader - Hook for managing manga reader state
 * Fetches folder assets and manages reader open/close state
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { Asset, Folder } from '../types';
import { agentimeHttp } from '../../agent/lib/agentime-client';

interface MangaReaderState {
  isOpen: boolean;
  folder: Folder | null;
}

export function useMangaReader() {
  const [state, setState] = useState<MangaReaderState>({
    isOpen: false,
    folder: null,
  });

  // Fetch assets for the folder when manga reader is open
  const { data, isLoading, error } = useSWR<Asset[]>(
    state.isOpen && state.folder
      ? `agentime:library:manga:${state.folder.id}`
      : null,
    () => agentimeHttp.listLibraryAssets({ folderId: state.folder!.id, limit: 100 }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Filter only image assets
  const images = (data ?? []).filter(
    (asset) => asset.fileType === 'image'
  );

  const openMangaReader = useCallback((folder: Folder) => {
    setState({ isOpen: true, folder });
  }, []);

  const closeMangaReader = useCallback(() => {
    setState({ isOpen: false, folder: null });
  }, []);

  return {
    isOpen: state.isOpen,
    folder: state.folder,
    images,
    isLoading,
    error: error?.message ?? null,
    openMangaReader,
    closeMangaReader,
  };
}
