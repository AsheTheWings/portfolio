'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { agentimeHttp } from '../../agent/lib/agentime-client';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Asset } from '../types';

const ASSET_CACHE_PREFIX = 'agentime:library:assets:';

export function useAssetMutations() {
  const { mutate } = useSWRConfig();
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const setError = useLibraryStore((state) => state.setError);
  const setTags = useLibraryStore((state) => state.setTags);
  const setLoadingTags = useLibraryStore((state) => state.setLoadingTags);
  const addAsset = useLibraryStore((state) => state.addAsset);
  const updateAsset = useLibraryStore((state) => state.updateAsset);
  const removeAsset = useLibraryStore((state) => state.removeAsset);

  const revalidateAssets = useCallback(() => {
    void mutate((key) => typeof key === 'string' && key.startsWith(ASSET_CACHE_PREFIX));
  }, [mutate]);

  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const assets = await agentimeHttp.listLibraryAssets({ limit: 100 });
      const tags = [...new Set(assets.flatMap((asset) => asset.tags))]
        .sort((left, right) => left.localeCompare(right))
        .map((tag) => ({ id: tag, tag }));
      setTags(tags);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load library tags');
    } finally {
      setLoadingTags(false);
    }
  }, [setError, setLoadingTags, setTags]);

  const patchAsset = useCallback(async (
    assetId: string,
    updates: { altText?: string | null; tags?: string[] },
  ): Promise<Asset | null> => {
    try {
      const asset = await agentimeHttp.updateLibraryAsset(assetId, updates);
      updateAsset(assetId, asset);
      revalidateAssets();
      return asset;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Asset update failed');
      return null;
    }
  }, [revalidateAssets, setError, updateAsset]);

  const deleteAsset = useCallback(async (assetId: string): Promise<boolean> => {
    try {
      await agentimeHttp.deleteLibraryAsset(assetId);
      removeAsset(assetId);
      revalidateAssets();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Asset deletion failed');
      return false;
    }
  }, [removeAsset, revalidateAssets, setError]);

  const deleteAssets = useCallback(async (assetIds: string[]): Promise<boolean> => {
    const results = await Promise.allSettled(
      assetIds.map((assetId) => agentimeHttp.deleteLibraryAsset(assetId)),
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') removeAsset(assetIds[index]!);
    });
    revalidateAssets();
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') {
      setError(rejected.reason instanceof Error ? rejected.reason.message : 'Some assets could not be deleted');
      return false;
    }
    return true;
  }, [removeAsset, revalidateAssets, setError]);

  const refreshAssetUrl = useCallback(async (assetId: string): Promise<string | null> => {
    try {
      const asset = await agentimeHttp.getLibraryAsset(assetId);
      updateAsset(assetId, asset);
      return asset.presentationUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Asset URL refresh failed');
      return null;
    }
  }, [setError, updateAsset]);

  const renameAsset = useCallback(async (assetId: string, fileName: string): Promise<boolean> => {
    try {
      const asset = await agentimeHttp.updateLibraryAsset(assetId, { fileName });
      updateAsset(assetId, asset);
      revalidateAssets();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Asset rename failed');
      return false;
    }
  }, [revalidateAssets, setError, updateAsset]);

  const copyAssetToFolder = useCallback(async (
    assetId: string,
    targetFolderId: string,
  ): Promise<boolean> => {
    try {
      const asset = await agentimeHttp.copyLibraryAsset(assetId, { folderId: targetFolderId });
      if (asset.folderId === currentFolderId || (!currentFolderId && asset.folderId === homeFolder?.id)) {
        addAsset(asset);
      }
      revalidateAssets();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Asset copy failed');
      return false;
    }
  }, [addAsset, currentFolderId, homeFolder?.id, revalidateAssets, setError]);

  const copyAssets = useCallback(async (
    assetIds: string[],
    targetFolderId: string,
  ): Promise<boolean> => {
    const results = await Promise.allSettled(
      assetIds.map((assetId) => agentimeHttp.copyLibraryAsset(assetId, { folderId: targetFolderId })),
    );
    revalidateAssets();
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') {
      setError(rejected.reason instanceof Error ? rejected.reason.message : 'Some assets could not be copied');
      return false;
    }
    return true;
  }, [revalidateAssets, setError]);

  const moveAssets = useCallback(async (
    assetIds: string[],
    targetFolderId: string,
  ): Promise<boolean> => {
    const results = await Promise.allSettled(
      assetIds.map((assetId) => agentimeHttp.updateLibraryAsset(assetId, { folderId: targetFolderId })),
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') removeAsset(assetIds[index]!);
    });
    revalidateAssets();
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') {
      setError(rejected.reason instanceof Error ? rejected.reason.message : 'Some assets could not be moved');
      return false;
    }
    return true;
  }, [removeAsset, revalidateAssets, setError]);

  return {
    fetchTags,
    patchAsset,
    deleteAsset,
    deleteAssets,
    refreshAssetUrl,
    revalidateAssets,
    renameAsset,
    copyAssetToFolder,
    copyAssets,
    moveAssets,
  };
}
