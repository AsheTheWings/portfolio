'use client';

import { useEffect, useRef, useState } from 'react';
import { agentimeHttp } from '../../agent/lib/agentime-client';
import type { LightAssetItem } from '../components/LightAssetGrid';
import { listAllLibraryAssets, normalizeLibraryPath } from '../lib/agentime-library';

const PATHS_DEBOUNCE_MS = 500;

interface UseLibraryItemsByPathsResult {
  items: LightAssetItem[];
  isLoading: boolean;
  error: string | null;
}

export function useLibraryItemsByPaths(
  paths?: string[],
  assetIds?: string[],
): UseLibraryItemsByPathsResult {
  const [items, setItems] = useState<LightAssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousKey = useRef('');

  useEffect(() => {
    const ids = assetIds?.filter(Boolean) ?? [];
    const requestedPaths = paths?.map(normalizeLibraryPath).filter(Boolean) ?? [];
    if (ids.length === 0 && requestedPaths.length === 0) {
      setItems([]);
      setError(null);
      previousKey.current = '';
      return;
    }

    const key = ids.length > 0
      ? `ids:${[...ids].sort().join(',')}`
      : `paths:${[...requestedPaths].sort().join(',')}`;
    if (key === previousKey.current) return;
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const folders = await agentimeHttp.listLibraryFolders();
        const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
        const assets = ids.length > 0
          ? await Promise.all(ids.map((id) => agentimeHttp.getLibraryAsset(id)))
          : await listAllLibraryAssets();
        const assetsByPath = new Map(assets.map((asset) => {
          const folder = foldersById.get(asset.folderId);
          return [normalizeLibraryPath(`${folder?.path ?? ''}/${asset.fileName}`).toLowerCase(), asset];
        }));
        const selectedAssets = ids.length > 0
          ? assets
          : requestedPaths.map((path) => assetsByPath.get(path.toLowerCase())).filter((asset) => asset !== undefined);
        if (!active) return;
        setItems(selectedAssets.map((asset) => {
          const folder = foldersById.get(asset.folderId);
          return {
            id: asset.id,
            name: asset.fileName,
            path: normalizeLibraryPath(`${folder?.path ?? ''}/${asset.fileName}`),
            type: 'asset' as const,
            presentationUrl: asset.presentationUrl ?? undefined,
            fileType: asset.fileType,
            mimeType: asset.mimeType,
          };
        }));
        previousKey.current = key;
      } catch (cause) {
        if (!active) return;
        setItems([]);
        setError(cause instanceof Error ? cause.message : 'Failed to load library items');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => void load(), ids.length > 0 ? 0 : PATHS_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assetIds, paths]);

  return { items, isLoading, error };
}
