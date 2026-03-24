/**
 * Library Page - Server Component
 * Fetches all folders and resolves path navigation server-side
 * Supports ?path= query param for direct navigation to a specific folder/item
 */

import { redirect } from 'next/navigation';
import { AuthHandlers } from '@/features/authentication/api';
import { FolderService } from '@/features/library/services/folder.service';
import { AssetService } from '@/features/library/services/asset.service';
import { Library, type InitialNavigationState } from '@/features/library/components/Library';
import type { Folder, Asset } from '@/features/library';

/**
 * Resolve path query param to navigation state
 * Path format: "folder/subfolder/item" or "folder/subfolder"
 */
async function resolvePathNavigation(
  userId: string,
  allFolders: Folder[],
  pathQuery: string
): Promise<InitialNavigationState> {
  // Parse path to get folder path and potential item name
  const pathParts = pathQuery.split('/').filter(Boolean);
  if (pathParts.length === 0) {
    return { folderId: null };
  }
  
  // Try to find a folder matching the full path
  const fullPath = '/' + pathParts.join('/');
  let targetFolder = allFolders.find(f => f.path === fullPath);
  
  // If no exact folder match, try parent path (last part might be an item name)
  let selectedItemName: string | undefined;
  if (!targetFolder && pathParts.length > 1) {
    const parentPath = '/' + pathParts.slice(0, -1).join('/');
    targetFolder = allFolders.find(f => f.path === parentPath);
    if (targetFolder) {
      selectedItemName = pathParts[pathParts.length - 1];
    }
  }
  
  // If still no match, check if first part is a root folder
  if (!targetFolder && pathParts.length === 1) {
    targetFolder = allFolders.find(f => f.name === pathParts[0] && f.parentId === null);
    if (!targetFolder) {
      // Single part that's not a folder - might be an item at root
      selectedItemName = pathParts[0];
    }
  }
  
  const folderId = targetFolder?.id ?? null;
  
  // Build breadcrumbs from allFolders
  const breadcrumbs: Folder[] = [];
  if (folderId) {
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (!folder) break;
      breadcrumbs.unshift(folder);
      currentId = folder.parentId;
    }
  }
  
  // Fetch assets for target folder
  const { assets } = await AssetService.listAssets(userId, { folderId: folderId ?? undefined });
  
  // Get folders at this level
  const foldersAtLevel = folderId === null
    ? allFolders.filter(f => f.parentId === null)
    : allFolders.filter(f => f.parentId === folderId);
  
  return {
    folderId,
    assets,
    folders: foldersAtLevel,
    breadcrumbs,
    selectedItemName,
  };
}

interface LibraryPageProps {
  searchParams: Promise<{ path?: string }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const allFolders = await FolderService.getAllFolders(user.id);
    const params = await searchParams;
    
    // Resolve path navigation server-side
    let initialNavigation: InitialNavigationState | undefined;
    if (params.path) {
      initialNavigation = await resolvePathNavigation(user.id, allFolders, params.path);
    }
    
    return (
      <Library 
        initialFolders={allFolders} 
        initialNavigation={initialNavigation}
      />
    );
  } catch (error) {
    // Redirect to home if unauthorized
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/');
    }
    throw error;
  }
}
