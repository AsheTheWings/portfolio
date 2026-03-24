'use client';

/**
 * useLibraryItemHandlers - Click, context menu, and CRUD handlers for library items
 * Centralizes all item interaction logic
 */

import { useState, useCallback } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { toastSuccess, toastError } from '@/features/shared/components/FeedbackMessage';
import type { Asset, Folder, FileWithPath } from '../types';

interface DeleteTarget {
  type: 'asset' | 'folder' | 'multi';
  id?: string;
  ids?: string[];
  name: string;
}

interface UseLibraryItemHandlersOptions {
  // Navigation
  navigateToFolder: (folderId: string | null, folder?: Folder) => void;
  
  // Data
  displayFolders: Folder[];
  displayAssets: Asset[];
  
  // Actions
  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  createFolderTree: (paths: string[], parentId: string | null) => Promise<{ folderMap: Record<string, string>; folders: Folder[] }>;
  renameFolder: (folderId: string, name: string) => Promise<Folder>;
  deleteFolder: (folderId: string) => Promise<void>;
  uploadAsset: (request: { file: File; folder_id: string }) => Promise<Asset | null>;
  uploadAssets: (files: File[]) => Promise<void>;
  renameAsset: (assetId: string, name: string) => Promise<boolean>;
  deleteAsset: (assetId: string) => Promise<boolean>;
  deleteAssets: (assetIds: string[]) => Promise<boolean>;
  revalidateAssets: () => void;
}

export function useLibraryItemHandlers({
  navigateToFolder,
  displayFolders,
  displayAssets,
  createFolder,
  createFolderTree,
  renameFolder,
  deleteFolder,
  uploadAsset,
  uploadAssets,
  renameAsset,
  deleteAsset,
  deleteAssets,
  revalidateAssets,
}: UseLibraryItemHandlersOptions) {
  // Store state
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const folders = useLibraryStore((state) => state.folders);
  const assets = useLibraryStore((state) => state.assets);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const uploadingFiles = useLibraryStore((state) => state.uploadingFiles);
  const removeUploadingFile = useLibraryStore((state) => state.removeUploadingFile);
  const openViewer = useLibraryStore((state) => state.openViewer);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  const copyToClipboard = useLibraryStore((state) => state.copyToClipboard);
  const openRenameDialog = useLibraryStore((state) => state.openRenameDialog);
  const renameTarget = useLibraryStore((state) => state.renameTarget);
  const closeRenameDialog = useLibraryStore((state) => state.closeRenameDialog);

  // Dialog state
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // ================== Keyboard Navigation Handlers ==================

  const handleKeyboardEnter = useCallback((item: { id: string; type: 'folder' | 'asset' }) => {
    if (item.type === 'folder') {
      const folder = displayFolders.find(f => f.id === item.id);
      if (folder) {
        navigateToFolder(folder.id, folder);
      }
    } else {
      openViewer();
    }
  }, [displayFolders, navigateToFolder, openViewer]);

  const handleKeyboardDelete = useCallback((item: { id: string; type: 'folder' | 'asset' }) => {
    if (item.type === 'folder') {
      const folder = displayFolders.find(f => f.id === item.id);
      if (folder && !folder.is_system) {
        setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name });
      }
    } else {
      const asset = displayAssets.find(a => a.id === item.id);
      if (asset) {
        setDeleteTarget({ type: 'asset', id: asset.id, name: asset.file_name });
      }
    }
  }, [displayFolders, displayAssets]);

  // ================== Upload Handlers ==================

  const handleFilesAdded = useCallback(async (files: File[]) => {
    // Navigate to home folder if not in a folder
    if (!currentFolderId && homeFolder) {
      navigateToFolder(homeFolder.id);
    }
    await uploadAssets(files);
  }, [uploadAssets, currentFolderId, homeFolder, navigateToFolder]);

  const handleFolderAdded = useCallback(async (filesWithPaths: FileWithPath[], rootFolderName: string) => {
    const targetParentId = currentFolderId || null;
    
    try {
      // Extract unique folder paths from file paths
      const folderPaths = new Set<string>();
      for (const { relativePath } of filesWithPaths) {
        const parts = relativePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          folderPaths.add(parts.slice(0, i).join('/'));
        }
      }
      
      // Create folder tree
      const { folderMap } = await createFolderTree(
        Array.from(folderPaths),
        targetParentId
      );
      
      // Upload files to their respective folders
      const uploadPromises = filesWithPaths.map(({ file, relativePath }) => {
        const parts = relativePath.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        const targetFolderId = parentPath ? folderMap[parentPath] : targetParentId;
        
        return uploadAsset({
          file,
          folder_id: targetFolderId || '',
        });
      });
      
      await Promise.all(uploadPromises);
      
      // Refresh assets to show new content
      revalidateAssets();
      
      toastSuccess(`Uploaded ${filesWithPaths.length} files from "${rootFolderName}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload folder';
      toastError(message);
    }
  }, [currentFolderId, createFolderTree, uploadAsset, revalidateAssets]);

  const handleRetryUpload = useCallback((fileId: string) => {
    const file = uploadingFiles.find(f => f.id === fileId);
    if (file) {
      removeUploadingFile(fileId);
      uploadAssets([file.file]);
    }
  }, [uploadingFiles, removeUploadingFile, uploadAssets]);

  // ================== CRUD Handlers ==================

  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      await createFolder(name, currentFolderId);
      toastSuccess('Folder created', { description: name });
    } catch (err) {
      toastError('Failed to create folder', { description: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  }, [createFolder, currentFolderId]);

  const handleRename = useCallback(async (newName: string) => {
    if (!renameTarget) return;
    
    try {
      if (renameTarget.type === 'asset') {
        await renameAsset(renameTarget.id, newName);
        toastSuccess('Asset renamed', { description: `Renamed to "${newName}"` });
      } else {
        await renameFolder(renameTarget.id, newName);
        toastSuccess('Folder renamed', { description: `Renamed to "${newName}"` });
      }
    } catch (err) {
      toastError('Rename failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [renameTarget, renameAsset, renameFolder]);

  const handleRefresh = useCallback(() => {
    revalidateAssets();
  }, [revalidateAssets]);

  // ================== Shared Clipboard Helper ==================

  const handleClipboardAction = useCallback((
    itemType: 'asset' | 'folder',
    itemId: string,
    itemName: string,
    operation: 'copy' | 'move'
  ) => {
    const actionVerb = operation === 'copy' ? 'Copied' : 'Cut';
    
    // If item is part of multi-selection, operate on all selected
    if (selectedIds.size > 1 && selectedIds.has(itemId)) {
      const hasAssets = assets.some(a => selectedIds.has(a.id));
      const hasFolders = folders.some(f => selectedIds.has(f.id));
      const type = hasAssets && hasFolders ? 'mixed' : hasAssets ? 'asset' : 'folder';
      copyToClipboard(type, Array.from(selectedIds), operation);
      toastSuccess(`${actionVerb} ${selectedIds.size} items to clipboard`);
    } else {
      copyToClipboard(itemType, itemId, operation);
      toastSuccess(`${actionVerb} to clipboard`, { description: itemName });
    }
  }, [copyToClipboard, selectedIds, assets, folders]);

  const handleDeleteRequest = useCallback((
    itemType: 'asset' | 'folder',
    itemId: string,
    itemName: string
  ) => {
    if (selectedIds.size > 1 && selectedIds.has(itemId)) {
      setDeleteTarget({ 
        type: 'multi', 
        ids: Array.from(selectedIds), 
        name: `${selectedIds.size} items` 
      });
    } else {
      setDeleteTarget({ type: itemType, id: itemId, name: itemName });
    }
  }, [selectedIds]);

  // ================== Context Menu: Asset ==================

  const handleAssetRename = useCallback((asset: Asset) => {
    openRenameDialog('asset', asset.id, asset.file_name);
  }, [openRenameDialog]);

  const handleAssetCopy = useCallback((asset: Asset) => {
    handleClipboardAction('asset', asset.id, asset.file_name, 'copy');
  }, [handleClipboardAction]);

  const handleAssetCut = useCallback((asset: Asset) => {
    handleClipboardAction('asset', asset.id, asset.file_name, 'move');
  }, [handleClipboardAction]);

  const handleAssetDeleteRequest = useCallback((asset: Asset) => {
    handleDeleteRequest('asset', asset.id, asset.file_name);
  }, [handleDeleteRequest]);

  const handleAssetDownload = useCallback(async (asset: Asset) => {
    // Determine which assets to download
    const assetsToDownload: Asset[] =
      selectedIds.size > 1 && selectedIds.has(asset.id)
        ? assets.filter(a => selectedIds.has(a.id) && a.url)
        : asset.url ? [asset] : [];

    if (assetsToDownload.length === 0) return;

    const downloadOne = async (a: Asset) => {
      try {
        const response = await fetch(a.url!);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = a.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(a.url!, '_blank');
      }
    };

    // Download sequentially to avoid browser popup blocking
    for (const a of assetsToDownload) {
      await downloadOne(a);
    }
  }, [selectedIds, assets]);

  // ================== Context Menu: Folder ==================

  const handleFolderRename = useCallback((folder: Folder) => {
    openRenameDialog('folder', folder.id, folder.name);
  }, [openRenameDialog]);

  const handleFolderCopy = useCallback((folder: Folder) => {
    handleClipboardAction('folder', folder.id, folder.name, 'copy');
  }, [handleClipboardAction]);

  const handleFolderCut = useCallback((folder: Folder) => {
    handleClipboardAction('folder', folder.id, folder.name, 'move');
  }, [handleClipboardAction]);

  const handleFolderDeleteRequest = useCallback((folder: Folder) => {
    handleDeleteRequest('folder', folder.id, folder.name);
  }, [handleDeleteRequest]);

  // ================== Confirm Delete ==================

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    
    try {
      if (deleteTarget.type === 'multi' && deleteTarget.ids) {
        // Separate folder IDs from asset IDs
        const folderIds = deleteTarget.ids.filter(id => 
          folders.some(f => f.id === id)
        );
        const assetIds = deleteTarget.ids.filter(id => 
          assets.some(a => a.id === id)
        );
        
        // Delete folders first (they might contain assets)
        for (const folderId of folderIds) {
          await deleteFolder(folderId);
        }
        
        // Delete remaining assets
        if (assetIds.length > 0) {
          await deleteAssets(assetIds);
        }
        
        toastSuccess(`Deleted ${deleteTarget.ids.length} items`);
        clearSelection();
      } else if (deleteTarget.type === 'asset' && deleteTarget.id) {
        await deleteAsset(deleteTarget.id);
        toastSuccess('Asset deleted', { description: deleteTarget.name });
      } else if (deleteTarget.type === 'folder' && deleteTarget.id) {
        await deleteFolder(deleteTarget.id);
        toastSuccess('Folder deleted', { description: deleteTarget.name });
      }
    } catch (err) {
      toastError('Delete failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteAsset, deleteAssets, deleteFolder, clearSelection, folders, assets]);

  // ================== Select Handler for Context Menu ==================

  const handleSelectForContextMenu = useCallback((id: string) => {
    if (!selectedIds.has(id)) {
      useLibraryStore.setState({ selectedIds: new Set([id]) });
    }
  }, [selectedIds]);

  return {
    // Dialog state
    showCreateFolderDialog,
    setShowCreateFolderDialog,
    deleteTarget,
    setDeleteTarget,
    renameTarget,
    closeRenameDialog,

    // Folder context menu handlers
    handleFolderRename,
    handleFolderCopy,
    handleFolderCut,
    handleFolderDeleteRequest,

    // Asset context menu handlers
    handleAssetRename,
    handleAssetCopy,
    handleAssetCut,
    handleAssetDeleteRequest,
    handleAssetDownload,

    // Keyboard handlers
    handleKeyboardEnter,
    handleKeyboardDelete,

    // Upload handlers
    handleFilesAdded,
    handleFolderAdded,
    handleRetryUpload,

    // CRUD handlers
    handleCreateFolder,
    handleRename,
    handleRefresh,
    handleConfirmDelete,

    // Context menu helpers
    handleSelectForContextMenu,
  };
}
