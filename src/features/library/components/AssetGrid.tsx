'use client';

import { ReactNode, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AssetCard } from './AssetCard';
import { AssetSkeleton } from './AssetSkeleton';
import { FolderCard } from './FolderCard';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useGridColumns } from '../hooks/useGridColumns';
import type { Asset, Folder } from '../types';
import type { LibraryMode } from './Library';

export interface AssetGridProps {
  /** Mode: 'default' for full library, 'picker' for asset selection */
  mode?: LibraryMode;
  onRetryUpload?: (uploadId: string) => void;
  emptyMessage?: string;
  emptySubtext?: string;
  /** Optional wrapper for each asset (e.g., context menu) */
  renderAssetWrapper?: (asset: Asset, children: ReactNode) => ReactNode;
  /** Optional wrapper for each folder (e.g., context menu) */
  renderFolderWrapper?: (folder: Folder, children: ReactNode) => ReactNode;
  /** Override assets (for search results) */
  overrideAssets?: Asset[];
  /** Override folders (for search results) */
  overrideFolders?: Folder[];
  /** Whether search is in progress */
  isSearching?: boolean;
  /** Callback for folder navigation (used in picker mode) */
  onFolderNavigate?: (folderId: string, folder?: Folder) => void;
  /** Whether at context root (shows deselect buttons) */
  isContextRoot?: boolean;
  /** Callback to remove item from context */
  onRemoveFromContext?: (id: string) => void;
  /** Whether selection mode is active (click toggles selection) */
  isSelectionMode?: boolean;
}

export function AssetGrid({
  mode = 'default',
  onRetryUpload,
  emptyMessage = 'No assets yet',
  emptySubtext = 'Upload some assets to get started',
  renderAssetWrapper,
  renderFolderWrapper,
  overrideAssets,
  overrideFolders,
  isSearching = false,
  onFolderNavigate,
  isContextRoot = false,
  onRemoveFromContext,
  isSelectionMode = false,
}: AssetGridProps) {
  const isPickerMode = mode === 'picker';
  // Get state from store
  const storeAssets = useLibraryStore((s) => s.assets);
  const storeFolders = useLibraryStore((s) => s.folders);
  const currentFolderId = useLibraryStore((s) => s.currentFolderId);
  const homeFolder = useLibraryStore((s) => s.homeFolder);
  const allFolders = useLibraryStore((s) => s.allFolders);
  const currentPage = useLibraryStore((s) => s.currentPage);
  
  // Dynamic itemsPerPage based on grid columns
  const { itemsPerPage } = useGridColumns();
  
  // Use override data if provided, otherwise use store data
  const assets = overrideAssets ?? storeAssets;
  const folders = overrideFolders ?? storeFolders;
  const uploadingFiles = useLibraryStore((s) => s.uploadingFiles);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const isLoadingFolders = useLibraryStore((s) => s.isLoadingFolders);
  const selectedIds = useLibraryStore((s) => s.selectedIds);
  const removeUploadingFile = useLibraryStore((s) => s.removeUploadingFile);
  const openViewer = useLibraryStore((s) => s.openViewer);
  const navigateToFolder = useLibraryStore((s) => s.navigateToFolder);

  // Click handlers - internalized to reduce prop drilling
  const handleAssetClick = (asset: Asset) => {
    const currentSelection = useLibraryStore.getState().selectedIds;
    
    if (currentSelection.size > 1 || isSelectionMode) {
      // Multi-select mode - toggle this item
      const next = new Set(currentSelection);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.add(asset.id);
      }
      useLibraryStore.setState({ selectedIds: next });
    } else if (currentSelection.has(asset.id) && currentSelection.size === 1) {
      // Already selected - open viewer
      openViewer();
    } else {
      // Set as only selected item
      useLibraryStore.setState({ selectedIds: new Set([asset.id]) });
    }
  };

  const handleFolderClick = (folder: Folder) => {
    const currentSelection = useLibraryStore.getState().selectedIds;
    
    if (currentSelection.size > 1 || isSelectionMode) {
      // Multi-select mode - toggle this item
      const next = new Set(currentSelection);
      if (next.has(folder.id)) {
        next.delete(folder.id);
      } else {
        next.add(folder.id);
      }
      useLibraryStore.setState({ selectedIds: next });
    } else if (currentSelection.has(folder.id) && currentSelection.size === 1) {
      // Already selected - navigate into folder
      if (onFolderNavigate) {
        onFolderNavigate(folder.id, folder);
      } else {
        navigateToFolder(folder.id, folder);
      }
    } else {
      // Set as only selected item
      useLibraryStore.setState({ selectedIds: new Set([folder.id]) });
    }
  };

  const handleFolderDoubleClick = (folder: Folder) => {
    if (onFolderNavigate) {
      onFolderNavigate(folder.id, folder);
    } else {
      navigateToFolder(folder.id, folder);
    }
  };

  // Get expected asset count from current folder for accurate skeleton rendering
  const currentFolder = useMemo(() => {
    const folderId = currentFolderId || homeFolder?.id;
    if (!folderId) return null;
    return allFolders.find(f => f.id === folderId) || null;
  }, [currentFolderId, homeFolder, allFolders]);
  
  const expectedAssetCount = currentFolder?.assets_count ?? 0;

  // Build a set of asset IDs for quick lookup
  const assetIdSet = useMemo(() => new Set(assets.map(a => a.id)), [assets]);

  // Filter uploading files to only show those in current folder
  // Exclude completed uploads whose finalAssetId now exists in the assets array
  const activeUploads = useMemo(() => {
    return uploadingFiles.filter(f => {
      // Must match current folder
      if (f.folderId !== currentFolderId) return false;
      // If completed and asset is now in the fetched data, hide the upload card
      if (f.status === 'completed' && f.finalAssetId && assetIdSet.has(f.finalAssetId)) {
        return false;
      }
      return true;
    });
  }, [uploadingFiles, currentFolderId, assetIdSet]);

  // Cleanup completed uploads when their asset appears in the data
  useEffect(() => {
    const completedToRemove = uploadingFiles.filter(
      f => f.status === 'completed' && f.finalAssetId && assetIdSet.has(f.finalAssetId)
    );
    completedToRemove.forEach(f => removeUploadingFile(f.id));
  }, [uploadingFiles, assetIdSet, removeUploadingFile]);

  // Cleanup completed uploads targeting different folders (e.g., folder uploads to subfolders)
  // Wait until ALL uploads are done before removing completed items
  useEffect(() => {
    const uploadsInOtherFolders = uploadingFiles.filter(
      f => f.folderId && f.folderId !== currentFolderId
    );
    
    if (uploadsInOtherFolders.length === 0) return;
    
    // Check if all uploads to other folders are completed
    const allCompleted = uploadsInOtherFolders.every(f => f.status === 'completed');
    if (!allCompleted) return;
    
    const timer = setTimeout(() => {
      uploadsInOtherFolders.forEach(f => removeUploadingFile(f.id));
    }, 1500); // Brief delay to show completion status
    
    return () => clearTimeout(timer);
  }, [uploadingFiles, currentFolderId, removeUploadingFile]);

  // Calculate upload progress for each folder
  const folderUploadProgress = useMemo(() => {
    const progress = new Map<string, { total: number; completed: number; progress: number }>();
    
    uploadingFiles.forEach(f => {
      if (!f.folderId) return;
      
      const current = progress.get(f.folderId) || { total: 0, completed: 0, progress: 0 };
      current.total += 1;
      
      if (f.status === 'completed') {
        current.completed += 1;
        current.progress += 100;
      } else {
        current.progress += f.progress || 0;
      }
      
      progress.set(f.folderId, current);
    });
    
    return progress;
  }, [uploadingFiles]);

  // Sort folders: system folders first (by updated_at desc), then user folders (by updated_at desc)
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      // System folders first
      if (a.is_system !== b.is_system) {
        return a.is_system ? -1 : 1;
      }
      // Within same type, sort by updated_at descending
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [folders]);

  // Sort assets by updated_at descending
  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [assets]);

  // Client-side pagination: combine folders + assets, slice for current page
  // In picker mode, show all items (no pagination)
  const paginatedItems = useMemo(() => {
    // Combined list: folders first, then assets
    type GridItem = { type: 'folder'; data: Folder } | { type: 'asset'; data: Asset };
    const allItems: GridItem[] = [
      ...sortedFolders.map(f => ({ type: 'folder' as const, data: f })),
      ...sortedAssets.map(a => ({ type: 'asset' as const, data: a })),
    ];
    
    // Skip pagination in picker mode - show all items
    if (isPickerMode) {
      return allItems;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return allItems.slice(startIndex, endIndex);
  }, [sortedFolders, sortedAssets, currentPage, itemsPerPage, isPickerMode]);

  // Separate paginated items back into folders and assets for rendering
  const paginatedFolders = paginatedItems.filter(i => i.type === 'folder').map(i => i.data as Folder);
  const paginatedAssets = paginatedItems.filter(i => i.type === 'asset').map(i => i.data as Asset);

  const hasContent = assets.length > 0 || activeUploads.length > 0 || folders.length > 0;
  const showSkeletons = (isLoading || isLoadingFolders) && !hasContent;

  // Grid classes
  const gridClasses = isPickerMode
    ? 'grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 p-3'
    : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4';

  if (showSkeletons) {
    return (
      <div className={gridClasses}>
        {Array.from({ length: expectedAssetCount }, (_, i) => (
          <AssetSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (!hasContent && !isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-medium text-foreground mb-1">
          {emptyMessage}
        </h3>
        <p className="text-sm text-muted-foreground text-center">
          {emptySubtext}
        </p>
      </div>
    );
  }

  return (
    <div className={`${gridClasses} ${isPickerMode ? '' : 'pb-12 pr-2'}`}>
      {/* 1. Folders (paginated with assets) */}
      {paginatedFolders.map((folder) => {
        const isMultiSelect = selectedIds.size > 1;
        const uploadProgress = folderUploadProgress.get(folder.id);
        const folderCard = (
          <div className="h-full w-full group">
            <FolderCard
              folder={folder}
              isSelected={selectedIds.has(folder.id)}
              isMultiSelected={isMultiSelect && selectedIds.has(folder.id)}
              uploadProgress={uploadProgress}
              onClick={() => handleFolderClick(folder)}
              onDoubleClick={() => handleFolderDoubleClick(folder)}
              mode={mode}
              showRemoveButton={isContextRoot}
              onRemove={onRemoveFromContext ? () => onRemoveFromContext(folder.id) : undefined}
            />
          </div>
        );

        return (
          <div key={folder.id} data-item-id={folder.id}>
            {renderFolderWrapper ? renderFolderWrapper(folder, folderCard) : folderCard}
          </div>
        );
      })}

      {/* 2. Uploading assets (for current folder) */}
      <AnimatePresence mode="popLayout">
        {activeUploads.map((uploadingFile) => (
          <div key={uploadingFile.id} className="group">
            <AssetCard
              uploadingFile={uploadingFile}
              onCancelUpload={() => removeUploadingFile(uploadingFile.id)}
              onRetryUpload={() => onRetryUpload?.(uploadingFile.id)}
            />
          </div>
        ))}
      </AnimatePresence>

      {/* 3. Completed assets (paginated) */}
      {paginatedAssets.map((asset) => {
        const isMultiSelect = selectedIds.size > 1;
        const assetCard = (
          <div className="group">
            <AssetCard
              asset={asset}
              isSelected={selectedIds.has(asset.id)}
              isMultiSelected={isMultiSelect && selectedIds.has(asset.id)}
              onSelect={() => handleAssetClick(asset)}
              showRemoveButton={isContextRoot}
              onRemove={onRemoveFromContext ? () => onRemoveFromContext(asset.id) : undefined}
            />
          </div>
        );

        return (
          <div key={asset.id} data-item-id={asset.id}>
            {renderAssetWrapper ? renderAssetWrapper(asset, assetCard) : assetCard}
          </div>
        );
      })}
    </div>
  );
}

export default AssetGrid;
