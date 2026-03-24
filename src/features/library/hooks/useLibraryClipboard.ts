'use client';

/**
 * useLibraryClipboard - Clipboard paste operations for library
 * Handles copy/move logic with asset/folder separation
 */

import { useCallback } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { toastSuccess, toastError, toastWarning } from '@/features/shared/components/FeedbackMessage';

interface UseLibraryClipboardOptions {
  copyAssets: (ids: string[], targetFolderId: string) => Promise<boolean>;
  moveAssets: (ids: string[], targetFolderId: string) => Promise<boolean>;
}

export function useLibraryClipboard({
  copyAssets,
  moveAssets,
}: UseLibraryClipboardOptions) {
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const allFolders = useLibraryStore((state) => state.allFolders);
  const clipboard = useLibraryStore((state) => state.clipboard);
  const clearClipboard = useLibraryStore((state) => state.clearClipboard);

  // Get target folder for paste operations
  const getTargetFolderId = useCallback(() => {
    return currentFolderId || homeFolder?.id || null;
  }, [currentFolderId, homeFolder]);

  const canPaste = clipboard.ids.length > 0 && clipboard.operation !== null;

  // Handle paste action
  // @param overrideTargetFolderId - Optional folder ID to paste into (for pasting into a specific folder)
  const handlePaste = useCallback(async (overrideTargetFolderId?: string) => {
    if (clipboard.ids.length === 0 || !clipboard.type) return;
    
    // Use override if provided (pasting into a specific folder), otherwise use current location
    const targetFolderId = overrideTargetFolderId || getTargetFolderId();
    const isAtRoot = !overrideTargetFolderId && currentFolderId === null;
    
    // Separate asset IDs from folder IDs based on allFolders
    const assetIds = clipboard.ids.filter(id => !allFolders.some(f => f.id === id));
    const folderIds = clipboard.ids.filter(id => allFolders.some(f => f.id === id));
    
    // Assets cannot be pasted at library root level
    if (isAtRoot && assetIds.length > 0) {
      if (folderIds.length === 0) {
        toastWarning('Cannot paste assets at root level', { description: 'Navigate into a folder first' });
        return;
      }
      // If mixed, warn and only paste folders
      toastWarning(`Skipping ${assetIds.length} assets`, { description: 'Assets cannot be pasted at root level' });
    }

    try {
      let count = 0;
      
      // Paste assets (only if inside a folder)
      if (!isAtRoot && targetFolderId && assetIds.length > 0) {
        if (clipboard.operation === 'move') {
          // Move = just update folder_id (instant, no file copy)
          const result = await moveAssets(assetIds, targetFolderId);
          count = result ? assetIds.length : 0;
        } else {
          // Copy = duplicate files
          const result = await copyAssets(assetIds, targetFolderId);
          count = result ? assetIds.length : 0;
        }
      }
      
      // Paste folders (can be pasted at root or inside folder)
      if (folderIds.length > 0) {
        toastWarning('Folder paste not yet supported');
      }
      
      if (count > 0) {
        const action = clipboard.operation === 'move' ? 'Moved' : 'Copied';
        toastSuccess(count === 1 ? `${action} asset` : `${action} ${count} assets`);
      }
      
      clearClipboard();
    } catch (err) {
      toastError('Paste failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [clipboard, currentFolderId, getTargetFolderId, copyAssets, moveAssets, clearClipboard, allFolders]);

  return {
    canPaste,
    handlePaste,
  };
}
