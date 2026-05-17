'use client';

/**
 * useLibraryItemsByPaths - Fetch library items by paths or IDs
 * Resolves library paths to actual asset/folder data with thumbnails
 * 
 * Path-based lookups are debounced (500ms) to prevent rapid-fire API calls
 * during streaming when @library/ mentions are being typed character by character.
 * ID-based lookups are immediate since IDs don't change incrementally.
 */

import { useEffect, useState, useRef } from 'react';
import type { LightAssetItem } from '../components/LightAssetGrid';
import type { Asset, ApiLightAssetItem } from '../types';

const PATHS_DEBOUNCE_MS = 500;

interface UseLibraryItemsByPathsResult {
  items: LightAssetItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch library items by their paths or asset IDs
 * @param paths - Array of library paths to resolve (debounced)
 * @param assetIds - Optional array of asset IDs (immediate, takes precedence)
 */
export function useLibraryItemsByPaths(
  paths?: string[],
  assetIds?: string[]
): UseLibraryItemsByPathsResult {
  const [items, setItems] = useState<LightAssetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track previous request to avoid duplicates
  const prevKeyRef = useRef<string>('');
  // Track active AbortController
  const controllerRef = useRef<AbortController | null>(null);
  // Track debounce timer for path-based fetches
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const hasAssetIds = assetIds && assetIds.length > 0;
    const hasPaths = paths && paths.length > 0;
    
    if (!hasAssetIds && !hasPaths) {
      // Clear debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setItems([]);
      setError(null);
      prevKeyRef.current = '';
      return;
    }
    
    // Create cache key
    const cacheKey = hasAssetIds 
      ? `ids:${[...assetIds!].sort().join(',')}`
      : `paths:${[...paths!].sort().join(',')}`;
    
    if (cacheKey === prevKeyRef.current) {
      return;
    }
    
    const executeFetch = () => {
      // Abort any in-flight request
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      
      const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
          if (hasAssetIds) {
            const params = new URLSearchParams();
            assetIds!.forEach(id => params.append('ids', id));
            
            const response = await fetch(`/api/library/assets?${params.toString()}`, {
              signal: controller.signal,
            });
            
            if (!response.ok) {
              throw new Error('Failed to fetch assets');
            }
            
            const data = await response.json();
            const assets = data.assets || [];
            
            setItems(assets.map((asset: Asset & { folder?: { path: string } }) => ({
              id: asset.id,
              name: asset.fileName,
              path: asset.folder?.path 
                ? `${asset.folder.path.replace(/^\//, '')}/${asset.fileName}`
                : asset.fileName,
              type: 'asset' as const,
              thumbnailUrl: asset.thumbnailUrl,
              storageUrl: asset.url,
              fileType: asset.fileType,
              mimeType: asset.mimeType,
            })));
          } else {
            const response = await fetch('/api/library/browse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'batch_get_metadata', paths }),
              signal: controller.signal,
            });
            
            if (!response.ok) {
              throw new Error('Failed to fetch library items');
            }
            
            const data = await response.json();
            if (data.status !== 'success' || !data.items) {
              setItems([]);
              return;
            }
            
            const items = data.items as Record<string, ApiLightAssetItem>;
            const resolvedItems: LightAssetItem[] = Object.values(items).map((item) => ({
              id: item.id,
              name: item.name,
              path: item.path,
              type: item.type,
              thumbnailUrl: item.thumbnailUrl,
              storageUrl: item.storageUrl,
              fileType: item.fileType,
              mimeType: item.mimeType,
            }));
            
            setItems(resolvedItems);
          }
          
          prevKeyRef.current = cacheKey;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          setError(err instanceof Error ? err.message : 'Failed to fetch library items');
          setItems([]);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchItems();
    };
    
    if (hasAssetIds) {
      // ID-based: fetch immediately (IDs don't arrive incrementally)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      executeFetch();
    } else {
      // Path-based: debounce to avoid rapid-fire fetches during streaming
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(executeFetch, PATHS_DEBOUNCE_MS);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      controllerRef.current?.abort();
    };
  }, [paths, assetIds]);
  
  return { items, isLoading, error };
}
