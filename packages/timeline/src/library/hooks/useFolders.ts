'use client';

/**
 * useFolderActions - Hook for folder CRUD operations
 * Folders are fetched server-side and hydrated into the store
 */

import { useCallback } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Folder } from '../types';
import { agentimeHttp } from '../../agent/lib/agentime-client';

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
    const folder = await agentimeHttp.createLibraryFolder({ name, parentId });
    addFolder(folder);
    return folder as Folder;
  }, [addFolder]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const folder = await agentimeHttp.updateLibraryFolder(folderId, { name });
    updateFolder(folderId, folder);
    return folder as Folder;
  }, [updateFolder]);

  const moveFolder = useCallback(async (folderId: string, newParentId: string | null) => {
    const folder = await agentimeHttp.updateLibraryFolder(folderId, { parentId: newParentId });
    updateFolder(folderId, folder);
    return folder as Folder;
  }, [updateFolder]);

  const deleteFolder = useCallback(async (folderId: string) => {
    await agentimeHttp.deleteLibraryFolder(folderId);
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
    const folderMap: Record<string, string> = {};
    const folders: Folder[] = [];
    for (const relativePath of [...new Set(paths)].sort((a, b) => a.split('/').length - b.split('/').length)) {
      const parts = relativePath.split('/').filter(Boolean);
      const name = parts.at(-1);
      if (!name) continue;
      const parentPath = parts.slice(0, -1).join('/');
      const created = await agentimeHttp.createLibraryFolder({
        name,
        parentId: parentPath ? folderMap[parentPath] ?? parentId : parentId,
      });
      folderMap[relativePath] = created.id;
      folders.push(created);
    }
    
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
