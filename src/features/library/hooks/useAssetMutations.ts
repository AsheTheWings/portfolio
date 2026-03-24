'use client';

/**
 * useAssetMutations - CRUD operations for assets
 * Handles delete, rename, copy, move, and other mutations
 */

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Asset } from '../types';

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

  /**
   * Revalidate assets cache (call after mutations)
   */
  const revalidateAssets = useCallback(() => {
    mutate((key) => typeof key === 'string' && key.startsWith('/api/library/assets'));
  }, [mutate]);

  /**
   * Fetch all tags
   */
  const fetchTags = useCallback(async () => {
    setLoadingTags(true);

    try {
      const response = await fetch('/api/library/tags');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch tags');
      }

      const tags = await response.json();
      setTags(tags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [setTags, setLoadingTags]);

  /**
   * Update an asset
   */
  const patchAsset = useCallback(async (
    assetId: string,
    updates: { altText?: string; tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/library/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Update failed');
      }

      const asset = await response.json();
      updateAsset(assetId, asset);
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      setError(message);
      return null;
    }
  }, [updateAsset, setError]);

  /**
   * Delete asset(s) - accepts single ID or array of IDs
   */
  const deleteAsset = useCallback(async (assetIds: string | string[]): Promise<boolean> => {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    
    try {
      const response = await fetch('/api/library/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      const result = await response.json();
      
      // Remove deleted assets from store
      result.deleted.forEach((id: string) => removeAsset(id));
      revalidateAssets();
      
      return result.failed.length === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      setError(message);
      return false;
    }
  }, [removeAsset, setError, revalidateAssets]);

  // Alias for backwards compatibility
  const deleteAssets = deleteAsset;

  /**
   * Refresh signed URL for an asset
   */
  const refreshAssetUrl = useCallback(async (assetId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/library/assets/${assetId}/url`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh URL');
      }

      const { url } = await response.json();
      updateAsset(assetId, { url });
      return url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh URL';
      setError(message);
      return null;
    }
  }, [updateAsset, setError]);

  /**
   * Rename an asset
   */
  const renameAsset = useCallback(async (assetId: string, newName: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/library/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: newName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Rename failed');
      }

      const asset = await response.json();
      updateAsset(assetId, asset);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rename failed';
      setError(message);
      return false;
    }
  }, [updateAsset, setError]);

  /**
   * Copy an asset to a target folder (single - kept for backwards compatibility)
   */
  const copyAssetToFolder = useCallback(async (
    assetId: string, 
    targetFolderId: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/library/assets/${assetId}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Copy failed');
      }

      const { asset } = await response.json();
      // Only add if copied to current folder
      if (asset.folderId === currentFolderId || (!currentFolderId && asset.folderId === homeFolder?.id)) {
        addAsset(asset);
      }
      revalidateAssets();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copy failed';
      setError(message);
      return false;
    }
  }, [currentFolderId, homeFolder, addAsset, setError, revalidateAssets]);

  /**
   * Copy asset(s) to a target folder (bulk)
   */
  const copyAssets = useCallback(async (
    assetIds: string | string[], 
    targetFolderId: string
  ): Promise<boolean> => {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    
    try {
      const response = await fetch('/api/library/assets/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folderId: targetFolderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Copy failed');
      }

      const result = await response.json();
      revalidateAssets();
      return result.failed.length === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copy failed';
      setError(message);
      return false;
    }
  }, [setError, revalidateAssets]);

  /**
   * Move asset(s) to a target folder (metadata update only - instant)
   */
  const moveAssets = useCallback(async (
    assetIds: string | string[], 
    targetFolderId: string | null
  ): Promise<boolean> => {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    
    try {
      const response = await fetch('/api/library/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folderId: targetFolderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Move failed');
      }

      const result = await response.json();
      
      // Remove moved assets from current view
      result.moved.forEach((id: string) => removeAsset(id));
      revalidateAssets();
      
      return result.failed.length === 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Move failed';
      setError(message);
      return false;
    }
  }, [removeAsset, setError, revalidateAssets]);

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
