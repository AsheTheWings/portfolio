'use client';

/**
 * useLibrary - Main hook for accessing library state and actions
 * Uses SWR for data fetching and Zustand for UI state
 */

import { useLibraryStore } from '../stores/useLibraryStore';
import { useAssetUpload } from './useAssetUpload';
import { useAssetMutations } from './useAssetMutations';
import { useAssets } from './useAssets';
import { useFolderActions } from './useFolders';
import { useFoldersQuery } from './useFoldersQuery';
import { useGridColumns } from './useGridColumns';

/**
 * Hook to access library state and actions
 */
export function useLibrary() {
  // SWR-based data fetching (syncs to store automatically)
  const { 
    assets, 
    total, 
    isLoading, 
    error, 
    isValidating,
    refresh: refreshAssets,
  } = useAssets();

  // Folder SWR (revalidates on focus, syncs to store)
  const {
    isValidating: isValidatingFolders,
    revalidate: revalidateFolders,
  } = useFoldersQuery();

  // Folder state (server-hydrated, read from store)
  const folders = useLibraryStore((state) => state.folders);
  const breadcrumbs = useLibraryStore((state) => state.breadcrumbs);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const isLoadingFolders = useLibraryStore((state) => state.isLoadingFolders);

  // Folder actions
  const {
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    createFolderTree,
  } = useFolderActions();
  
  // Navigation state
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const navigateToFolder = useLibraryStore((state) => state.navigateToFolder);
  const navigateUp = useLibraryStore((state) => state.navigateUp);

  // Additional store state not managed by SWR
  const tags = useLibraryStore((state) => state.tags);
  const isLoadingTags = useLibraryStore((state) => state.isLoadingTags);

  const filters = useLibraryStore((state) => state.filters);
  const currentPage = useLibraryStore((state) => state.currentPage);
  
  // Dynamic itemsPerPage based on grid columns
  const { itemsPerPage } = useGridColumns();

  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const focusedId = useLibraryStore((state) => state.focusedId);
  const selectionMode = useLibraryStore((state) => state.selectionMode);

  const isViewerOpen = useLibraryStore((state) => state.isViewerOpen);

  const uploadingFiles = useLibraryStore((state) => state.uploadingFiles);
  const isUploading = useLibraryStore((state) => state.isUploading);
  const showUploader = useLibraryStore((state) => state.showUploader);

  // Clipboard state
  const clipboard = useLibraryStore((state) => state.clipboard);
  const copyToClipboard = useLibraryStore((state) => state.copyToClipboard);
  const clearClipboard = useLibraryStore((state) => state.clearClipboard);

  // Rename dialog state
  const renameTarget = useLibraryStore((state) => state.renameTarget);
  const openRenameDialog = useLibraryStore((state) => state.openRenameDialog);
  const closeRenameDialog = useLibraryStore((state) => state.closeRenameDialog);

  // Action selectors (stable - won't cause re-renders)
  const setFilters = useLibraryStore((state) => state.setFilters);
  const setPage = useLibraryStore((state) => state.setPage);
  const resetFilters = useLibraryStore((state) => state.resetFilters);
  const setError = useLibraryStore((state) => state.setError);

  const toggleSelection = useLibraryStore((state) => state.toggleSelection);
  const selectAll = useLibraryStore((state) => state.selectAll);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  const setFocusedId = useLibraryStore((state) => state.setFocusedId);
  const setSelectionMode = useLibraryStore((state) => state.setSelectionMode);

  const openViewer = useLibraryStore((state) => state.openViewer);
  const closeViewer = useLibraryStore((state) => state.closeViewer);
  const navigateViewer = useLibraryStore((state) => state.navigateViewer);

  const setShowUploader = useLibraryStore((state) => state.setShowUploader);
  const removeUploadingFile = useLibraryStore((state) => state.removeUploadingFile);

  // Upload actions
  const {
    uploadAsset,
    uploadAssets,
  } = useAssetUpload();

  // Asset mutation actions
  const {
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
  } = useAssetMutations();

  // Computed values (client-side pagination: folders + assets combined)
  const totalItems = folders.length + assets.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasSelection = selectedIds.size > 0;
  const hasActiveUploads = uploadingFiles.some(f => f.status === 'uploading');

  return {
    // Navigation state
    currentFolderId,
    folders,
    breadcrumbs,
    homeFolder,
    isLoadingFolders,
    isValidatingFolders,
    navigateToFolder,
    navigateUp,
    revalidateFolders,

    // Folder actions
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    createFolderTree,

    // Assets state (from SWR)
    assets,
    total: totalItems,
    isLoading,
    isValidating,
    error,
    refreshAssets,

    // Tags state
    tags,
    isLoadingTags,

    // Filters & pagination
    filters,
    currentPage,
    itemsPerPage,
    totalPages,
    setFilters,
    setPage,
    resetFilters,

    // Selection state
    selectedIds,
    focusedId,
    selectionMode,
    hasSelection,
    toggleSelection,
    selectAll,
    clearSelection,
    setFocusedId,
    setSelectionMode,

    // Viewer state
    isViewerOpen,
    openViewer,
    closeViewer,
    navigateViewer,

    // Upload state
    uploadingFiles,
    isUploading,
    showUploader,
    hasActiveUploads,
    setShowUploader,
    removeUploadingFile,

    // API actions
    fetchTags,
    revalidateAssets,
    uploadAsset,
    uploadAssets,
    patchAsset,
    deleteAsset,
    deleteAssets,
    refreshAssetUrl,
    renameAsset,
    copyAssetToFolder,
    copyAssets,
    moveAssets,

    // Clipboard
    clipboard,
    copyToClipboard,
    clearClipboard,

    // Rename dialog
    renameTarget,
    openRenameDialog,
    closeRenameDialog,

    // Error handling
    setError,
    clearError: () => setError(null),
  };
}
