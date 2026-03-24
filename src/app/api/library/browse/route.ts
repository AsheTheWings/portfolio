/**
 * Library Browse API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { FolderService } from '@/features/library/services/folder.service';
import { AssetService } from '@/features/library/services/asset.service';
import type { Folder, Asset, LibraryItem, FolderTreeNode } from '@/features/library/types';

interface BrowseResult {
  status: 'success' | 'error';
  message?: string;
  items?: Record<string, LibraryItem>;
  tree?: FolderTreeNode[];
}

/**
 * Parse path to folder path and optional asset name
 * Expects clean paths (no @library/ prefix)
 */
function parsePath(path: string | undefined): { folderPath: string; assetName?: string } {
  if (!path) return { folderPath: '' };
  
  // Normalize: trim slashes
  const normalized = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  
  if (!normalized) return { folderPath: '' };
  
  // Check if last segment has file extension (indicates asset)
  // Extension must be alphabetic (e.g., .jpg, .webp) to avoid matching version numbers like .5
  const segments = normalized.split('/');
  const lastSegment = segments[segments.length - 1];
  const hasExtension = /\.[a-zA-Z]+$/.test(lastSegment);
  
  if (hasExtension && segments.length > 0) {
    return {
      folderPath: segments.slice(0, -1).join('/'),
      assetName: lastSegment,
    };
  }
  
  return { folderPath: normalized };
}

/**
 * Find folder by path
 */
async function findFolderByPath(userId: string, folderPath: string): Promise<Folder | null> {
  if (!folderPath) return null;
  
  const allFolders = await FolderService.getAllFolders(userId);
  
  const searchPath = `/${folderPath}`.replace(/^\/+/, '/');
  const homeSearchPath = `/home${searchPath}`;
  
  return allFolders.find(f => 
    f.path === searchPath || 
    f.path === homeSearchPath ||
    f.path === `/${folderPath}`
  ) || null;
}

/**
 * Find asset by name within a folder
 */
async function findAssetByName(
  userId: string, 
  folderId: string | null, 
  assetName: string
): Promise<Asset | null> {
  const { assets } = await AssetService.listAssets(userId, { folder_id: folderId || undefined });
  return assets.find(a => a.file_name === assetName) || null;
}

/**
 * Convert folder to LibraryItem
 */
function folderToItem(folder: Folder, parentPath: string = ''): LibraryItem {
  return {
    id: folder.id,
    name: folder.name,
    type: 'folder',
    path: parentPath ? `${parentPath}/${folder.name}` : folder.name,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
    assets_count: folder.assets_count,
  };
}

/**
 * Convert asset to LibraryItem
 * Path is derived from parentPath (folder.path) + file_name
 */
function assetToItem(asset: Asset, parentPath: string = ''): LibraryItem {
  return {
    id: asset.id,
    name: asset.file_name,
    type: 'asset',
    path: parentPath ? `${parentPath}/${asset.file_name}` : asset.file_name,
    mime_type: asset.mime_type || undefined,
    file_type: asset.file_type,
    size_kb: asset.size_kb || undefined,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
    tags: asset.tags?.map(t => t.tag) || [],
    thumbnail_url: asset.thumbnail_url || undefined,
    storage_url: asset.url || undefined,
  };
}

/**
 * Build folder tree recursively
 */
function buildFolderTree(folders: Folder[], parentId: string | null = null): FolderTreeNode[] {
  return folders
    .filter(f => f.parent_id === parentId)
    .map(f => ({
      id: f.id,
      name: f.name,
      path: f.path,
      assets_count: f.assets_count,
      children: buildFolderTree(folders, f.id),
    }));
}

// Action handlers
async function handleListItems(userId: string, path?: string): Promise<BrowseResult> {
  const { folderPath } = parsePath(path);
  const folder = await findFolderByPath(userId, folderPath);
  
  const folderId = folder?.id || null;
  // Use actual folder path (strip leading slash for cleaner display)
  const currentPath = folder?.path?.replace(/^\//, '') || '';
  
  const subfolders = await FolderService.listFolders(userId, folderId);
  const { assets } = await AssetService.listAssets(userId, { folder_id: folderId || undefined });
  
  const items: Record<string, LibraryItem> = {};
  
  for (const f of subfolders) {
    if (!f.is_system) {
      items[f.id] = folderToItem(f, currentPath);
    }
  }
  
  for (const a of assets) {
    items[a.id] = assetToItem(a, currentPath);
  }
  
  return { status: 'success', items };
}

async function handleGetMetadata(userId: string, path?: string): Promise<BrowseResult> {
  if (!path) {
    return { status: 'error', message: 'Path is required for get_metadata' };
  }
  
  const { folderPath, assetName } = parsePath(path);
  const folder = await findFolderByPath(userId, folderPath);
  
  const items: Record<string, LibraryItem> = {};
  
  if (assetName) {
    const asset = await findAssetByName(userId, folder?.id || null, assetName);
    if (!asset) {
      return { status: 'error', message: `Asset not found: ${path}` };
    }
    items[asset.id] = assetToItem(asset, folderPath);
  } else {
    if (!folder) {
      return { status: 'error', message: `Folder not found: ${path}` };
    }
    items[folder.id] = folderToItem(folder);
  }
  
  return { status: 'success', items };
}

async function handleReadAssets(userId: string, paths?: string[]): Promise<BrowseResult> {
  if (!paths || paths.length === 0) {
    return { status: 'error', message: 'Paths array is required for read_assets' };
  }
  
  const items: Record<string, LibraryItem> = {};
  const notFound: string[] = [];
  
  for (const path of paths) {
    const { folderPath, assetName } = parsePath(path);
    
    if (!assetName) {
      notFound.push(path);
      continue;
    }
    
    const folder = await findFolderByPath(userId, folderPath);
    const asset = await findAssetByName(userId, folder?.id || null, assetName);
    
    if (!asset) {
      notFound.push(path);
      continue;
    }
    
    items[asset.id] = assetToItem(asset, folderPath);
  }
  
  if (Object.keys(items).length === 0) {
    return { status: 'error', message: `No assets found: ${notFound.join(', ')}` };
  }
  
  const result: BrowseResult = { status: 'success', items };
  if (notFound.length > 0) {
    result.message = `Some assets not found: ${notFound.join(', ')}`;
  }
  
  return result;
}

async function handleReadFolder(userId: string, path?: string): Promise<BrowseResult> {
  if (!path) {
    return { status: 'error', message: 'Path is required for read_folder' };
  }
  
  const { folderPath } = parsePath(path);
  const folder = await findFolderByPath(userId, folderPath);
  
  if (!folder) {
    return { status: 'error', message: `Folder not found: ${path}` };
  }
  
  // Get all assets in folder recursively
  const assetRecords = await AssetService.getAssetsByIds([folder.id]);
  
  const items: Record<string, LibraryItem> = {};
  
  for (const record of assetRecords) {
    const asset = await AssetService.getAsset(userId, record.id);
    if (asset) {
      items[asset.id] = assetToItem(asset, folderPath);
    }
  }
  
  return { status: 'success', items };
}

/**
 * Batch get metadata for multiple paths in a single request
 */
async function handleBatchGetMetadata(userId: string, paths?: string[]): Promise<BrowseResult> {
  if (!paths || paths.length === 0) {
    return { status: 'error', message: 'Paths array is required for batch_get_metadata' };
  }
  
  const items: Record<string, LibraryItem> = {};
  
  // Process all paths in parallel
  await Promise.all(paths.map(async (path) => {
    try {
      const { folderPath, assetName } = parsePath(path);
      const folder = await findFolderByPath(userId, folderPath);
      
      if (assetName) {
        const asset = await findAssetByName(userId, folder?.id || null, assetName);
        if (asset) {
          items[asset.id] = assetToItem(asset, folderPath);
        }
      } else if (folder) {
        items[folder.id] = folderToItem(folder);
      }
    } catch {
      // Skip failed paths
    }
  }));
  
  return { status: 'success', items };
}

async function handleSearch(
  userId: string, 
  query?: string, 
  filters?: { file_type?: string; folder_path?: string }
): Promise<BrowseResult> {
  if (!query) {
    return { status: 'error', message: 'Query is required for search' };
  }
  
  let assets = await AssetService.searchAssets(userId, query, 50);
  
  if (filters?.file_type) {
    assets = assets.filter(a => a.file_type === filters.file_type);
  }
  
  const items: Record<string, LibraryItem> = {};
  for (const a of assets) {
    // Get folder path from joined folder data (strip leading slash)
    const folderPath = a.folder?.path?.replace(/^\/+/, '') || '';
    items[a.id] = assetToItem(a, folderPath);
  }
  
  return { status: 'success', items };
}

async function handleFolderTree(userId: string, path?: string): Promise<BrowseResult> {
  const allFolders = await FolderService.getAllFolders(userId);
  
  let rootParentId: string | null = null;
  
  if (path) {
    const { folderPath } = parsePath(path);
    const folder = await findFolderByPath(userId, folderPath);
    if (folder) {
      rootParentId = folder.id;
    }
  }
  
  const tree = buildFolderTree(allFolders, rootParentId);
  
  return { status: 'success', tree };
}

/**
 * POST /api/library/browse
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();
    const { action, path, paths, query, filters } = body;
    
    let result: BrowseResult;
    
    switch (action) {
      case 'list_items':
        result = await handleListItems(user.id, path);
        break;
      case 'get_metadata':
        result = await handleGetMetadata(user.id, path);
        break;
      case 'batch_get_metadata':
        result = await handleBatchGetMetadata(user.id, paths);
        break;
      case 'read_assets':
        result = await handleReadAssets(user.id, paths);
        break;
      case 'read_folder':
        result = await handleReadFolder(user.id, path);
        break;
      case 'search':
        result = await handleSearch(user.id, query, filters);
        break;
      case 'folder_tree':
        result = await handleFolderTree(user.id, path);
        break;
      default:
        result = {
          status: 'error',
          message: `Unknown action: ${action}. Valid: list_items, get_metadata, read_assets, read_folder, search, folder_tree`,
        };
    }
    
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
