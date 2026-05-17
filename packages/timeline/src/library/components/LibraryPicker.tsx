'use client';

/**
 * LibraryPicker - Picker mode wrapper for Library
 * Handles context view, selection mode, and picker-specific state
 * 
 * Features:
 * - Context view: display and navigate through selected context items
 * - Selection mode: toggle-select items for adding to context
 * - Folder deduplication: nested folders only shown via parent
 * - Cleanup on unmount: reset selection and navigation
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Library } from './Library';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useAssetsByIds } from '../hooks/useAssetsByIds';
import type { Asset, Folder } from '../types';
import { Layers } from 'lucide-react';

export interface LibraryPickerProps {
  /** IDs of items added to context (folders and/or assets) */
  contextItemIds: string[];
  /** Whether showing context view (vs library browse) */
  isContextView: boolean;
  /** Callback to remove item from context */
  onRemoveFromContext: (id: string) => void;
  /** Whether selection mode is active (click toggles selection) */
  isSelectionMode: boolean;
  /** Callback when selection is confirmed (double-click) */
  onSelectionConfirm?: (assets: Asset[]) => void;
  /** Custom class for container */
  className?: string;
}

export function LibraryPicker({
  contextItemIds,
  isContextView,
  onRemoveFromContext,
  isSelectionMode,
  onSelectionConfirm,
  className,
}: LibraryPickerProps) {
  // Store selectors
  const allFolders = useLibraryStore((state) => state.allFolders);
  const assets = useLibraryStore((state) => state.assets);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  const navigateToFolder = useLibraryStore((state) => state.navigateToFolder);
  
  // Context view navigation state (for navigating into context folders)
  const [contextFolderId, setContextFolderId] = useState<string | null>(null);
  const isContextRoot = isContextView && contextFolderId === null;
  
  // Reset context folder navigation when exiting context view
  useEffect(() => {
    if (!isContextView) {
      setContextFolderId(null);
    }
  }, [isContextView]);
  
  // Delete/Backspace to remove selected items from context (only at context root)
  useEffect(() => {
    if (!isContextRoot || selectedIds.size === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        
        e.preventDefault();
        // Remove all selected items from context
        for (const id of selectedIds) {
          onRemoveFromContext(id);
        }
        clearSelection();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isContextRoot, selectedIds, onRemoveFromContext, clearSelection]);
  
  // Create folder lookup map for O(1) access (moved up for use in navigateContextFolder)
  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    for (const folder of allFolders) {
      map.set(folder.id, folder);
    }
    return map;
    
  }, [allFolders]);
  
  // Navigate within context view (into a context folder)
  const navigateContextFolder = useCallback((folderId: string | null) => {
    setContextFolderId(folderId);
    // Also navigate in store to fetch assets for this folder
    if (folderId !== null) {
      navigateToFolder(folderId, folderMap.get(folderId));
    }
  }, [folderMap, navigateToFolder]);
  
  // Clear selection and reset navigation on unmount
  const clearSelectionRef = useRef(clearSelection);
  const navigateToFolderRef = useRef(navigateToFolder);
  clearSelectionRef.current = clearSelection;
  navigateToFolderRef.current = navigateToFolder;
  
  useEffect(() => {
    return () => {
      clearSelectionRef.current();
      navigateToFolderRef.current(null);
    };
  }, []);
  
  // Separate folder IDs from asset IDs (memoized)
  const { rootContextFolderIds, rootContextAssetIds } = useMemo(() => {
    const folderIds: string[] = [];
    const assetIds: string[] = [];
    
    for (const id of contextItemIds) {
      if (folderMap.has(id)) {
        folderIds.push(id);
      } else {
        assetIds.push(id);
      }
    }
    
    // Deduplicate: exclude folders that are subfolders of other context folders
    const contextFolderSet = new Set(folderIds);
    const deduplicatedFolderIds = folderIds.filter(folderId => {
      let currentId = folderMap.get(folderId)?.parentId;
      while (currentId) {
        if (contextFolderSet.has(currentId)) {
          return false;
        }
        currentId = folderMap.get(currentId)?.parentId;
      }
      return true;
    });
    
    return { rootContextFolderIds: deduplicatedFolderIds, rootContextAssetIds: assetIds };
  }, [contextItemIds, folderMap]);
  
  // Context folders to display (memoized)
  const contextDisplayFolders = useMemo(() => {
    if (isContextRoot) {
      const rootSet = new Set(rootContextFolderIds);
      return allFolders.filter(f => rootSet.has(f.id));
    }
    return allFolders.filter(f => f.parentId === contextFolderId);
  }, [isContextRoot, rootContextFolderIds, allFolders, contextFolderId]);
  
  // Build breadcrumbs for context navigation (memoized)
  const contextBreadcrumbs = useMemo(() => {
    if (!contextFolderId) return [];
    
    const crumbs: Folder[] = [];
    const contextRootSet = new Set(rootContextFolderIds);
    let currentId: string | null = contextFolderId;
    
    while (currentId) {
      const folder = folderMap.get(currentId);
      if (!folder) break;
      crumbs.unshift(folder);
      if (contextRootSet.has(currentId)) break;
      currentId = folder.parentId;
    }
    return crumbs;
  }, [contextFolderId, rootContextFolderIds, folderMap]);
  
  // Fetch assets for context view root level
  const { assets: fetchedContextAssets, isLoading: isLoadingContext } = useAssetsByIds(
    isContextRoot && rootContextAssetIds.length > 0 ? rootContextAssetIds : undefined,
    isContextView && isContextRoot
  );
  
  // Final context items for display
  const contextAssets = isContextRoot ? fetchedContextAssets : assets;
  
  // Handle folder navigation (context view or regular)
  const handleFolderNavigate = useCallback((folderId: string, folder?: Folder) => {
    if (isContextView) {
      navigateContextFolder(folderId);
    } else {
      navigateToFolder(folderId, folder);
    }
  }, [isContextView, navigateContextFolder, navigateToFolder]);
  
  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((folderId: string | null, folder?: Folder) => {
    if (isContextView) {
      navigateContextFolder(folderId);
    } else {
      navigateToFolder(folderId, folder);
    }
  }, [isContextView, navigateContextFolder, navigateToFolder]);

  return (
    <Library
      mode="picker"
      onSelectionConfirm={onSelectionConfirm}
      className={className}
      // Override data for context view
      overrideAssets={isContextView ? contextAssets : undefined}
      overrideFolders={isContextView ? contextDisplayFolders : undefined}
      overrideBreadcrumbs={isContextView ? contextBreadcrumbs : undefined}
      overrideOnNavigate={handleFolderNavigate}
      overrideOnBreadcrumbNavigate={handleBreadcrumbNavigate}
      // Context view props
      isContextRoot={isContextRoot}
      onRemoveFromContext={onRemoveFromContext}
      isSelectionMode={isSelectionMode}
      isLoading={isLoadingContext}
      // Breadcrumb customization
      rootLabel={isContextView ? 'Context' : 'Library'}
      RootIcon={isContextView ? Layers : undefined}
      // Disable drag selection in context view
      disableDragSelect={isContextView}
    />
  );
}

export default LibraryPicker;
