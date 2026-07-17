'use client';

/**
 * useAssetsByIds - Fetch assets by IDs
 * Simple hook for fetching specific assets, used for context view in picker
 */

import { useEffect, useState, useRef } from 'react';
import type { Asset } from '../types';
import { agentimeHttp } from '../../agent/lib/agentime-client';

interface UseAssetsByIdsResult {
  assets: Asset[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch assets by their IDs
 * @param ids - Array of asset IDs to fetch
 * @param enabled - Whether to fetch (default: true)
 */
export function useAssetsByIds(
  ids: string[] | undefined,
  enabled: boolean = true
): UseAssetsByIdsResult {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track previous IDs to avoid unnecessary fetches
  const prevIdsRef = useRef<string>('');
  
  useEffect(() => {
    // Skip if disabled or no IDs
    if (!enabled || !ids || ids.length === 0) {
      setAssets([]);
      setError(null);
      prevIdsRef.current = ''; // Reset so we refetch when re-enabled
      return;
    }
    
    const idsKey = [...ids].sort().join(',');
    
    // Skip if IDs match AND we successfully fetched before
    if (idsKey === prevIdsRef.current) {
      return;
    }
    
    const controller = new AbortController();
    
    const fetchAssets = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const resolved = await Promise.all(ids.map((id) => agentimeHttp.getLibraryAsset(id)));
        controller.signal.throwIfAborted();
        setAssets(resolved);
        // Only mark as fetched after successful completion
        prevIdsRef.current = idsKey;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Don't update prevIdsRef - allow retry
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch assets');
        setAssets([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAssets();
    
    return () => controller.abort();
  }, [ids, enabled]);
  
  return { assets, isLoading, error };
}
