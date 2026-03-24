'use client';

/**
 * useMangaReader - Hook for managing manga reader state
 * Fetches folder assets and manages reader open/close state
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { Asset, Folder } from '../types';

interface MangaReaderState {
  isOpen: boolean;
  folder: Folder | null;
}

interface AssetsResponse {
  assets: Asset[];
  total: number;
}

async function fetcher(url: string): Promise<AssetsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch assets');
  }
  return response.json();
}

export function useMangaReader() {
  const [state, setState] = useState<MangaReaderState>({
    isOpen: false,
    folder: null,
  });

  // Fetch assets for the folder when manga reader is open
  const { data, isLoading, error } = useSWR<AssetsResponse>(
    state.isOpen && state.folder
      ? `/api/library/assets?folderId=${state.folder.id}&fileType=image`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Filter only image assets
  const images = (data?.assets ?? []).filter(
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
