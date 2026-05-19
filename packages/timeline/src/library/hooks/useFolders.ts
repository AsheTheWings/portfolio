'use client';

/**
 * useFolderActions - Hook for folder CRUD operations
 * Folders are fetched server-side and hydrated into the store
 */

import { useCallback } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Folder } from '../types';

interface CreateFolderTreeResult {
  folderMap: Record<string, string>;
  folders: Folder[];
}

/**
 * Hook for folder CRUD actions
 */
export function useFolderActions() {
  const addFolder = useLibraryStore((state) => state.addFolder);
  const addFolders = useLibraryStore((state) => state.addFolders);
  const updateFolder = useLibraryStore((state) => state.updateFolder);
  const removeFolder = useLibraryStore((state) => state.removeFolder);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    const allFolders = useLibraryStore.getState().allFolders;
    const parentFolder = parentId ? allFolders.find(f => f.id === parentId) : null;

    // Calculate path: parent.path/name for nested, /name for root
    const normalizedName = name.trim().replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '_');
    const path = parentFolder ? `${parentFolder.path}/${normalizedName}` : `/${normalizedName}`;

    const response = await fetch('/api/library/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId, path }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create folder');
    }

    const { folder } = await response.json();
    addFolder(folder);
    return folder as Folder;
  }, [addFolder]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const response = await fetch(`/api/library/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to rename folder');
    }

    const { folder } = await response.json();
    updateFolder(folderId, folder);
    return folder as Folder;
  }, [updateFolder]);

  const moveFolder = useCallback(async (folderId: string, newParentId: string | null) => {
    const response = await fetch(`/api/library/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to move folder');
    }

    const { folder } = await response.json();
    updateFolder(folderId, folder);
    return folder as Folder;
  }, [updateFolder]);

  const deleteFolder = useCallback(async (folderId: string) => {
    const response = await fetch(`/api/library/folders/${folderId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete folder');
    }

    removeFolder(folderId);
  }, [removeFolder]);

  /**
   * Create a folder tree from a list of relative paths
   * @param paths - Array of relative paths (e.g., ["Photos", "Photos/2024", "Photos/2024/March"])
   * @param parentId - Parent folder ID (or null for current folder)
   * @returns Map of relative path to folder ID, plus created folders
   */
  const createFolderTree = useCallback(async (
    paths: string[],
    parentId: string | null
  ): Promise<CreateFolderTreeResult> => {
    const response = await fetch('/api/library/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, parentId: parentId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create folder tree');
    }

    const { folderMap, folders } = await response.json();
    
    // Add all created folders to the store
    addFolders(folders);
    
    return { folderMap, folders };
  }, [addFolders]);

  return {
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    createFolderTree,
  };
}
