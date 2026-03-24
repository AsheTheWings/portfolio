/**
 * Folder Service - Handles folder CRUD operations and navigation
 */

import { createClient } from '@/lib/supabase/server';
import { StorageService } from './storage.service';
import type { Folder, CreateFolderRequest, UpdateFolderRequest } from '../types';
import { normalizeName } from '../types';

export class FolderService {
  /**
   * Get user's home folder (creates if missing)
   */
  static async getHomeFolder(userId: string): Promise<Folder> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .eq('name', 'home')
      .eq('is_system', true)
      .is('parent_id', null)
      .maybeSingle();

    if (data) {
      return data;
    }

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get home folder: ${error.message}`);
    }

    // Home folder doesn't exist, create it
    const { data: newFolder, error: createError } = await supabase
      .from('folders')
      .insert({
        name: 'home',
        parent_id: null,
        user_id: userId,
        path: '/home',
        depth: 0,
        is_system: true,
      })
      .select()
      .single();

    if (createError) {
      // Handle race condition - folder may have been created by another request
      if (createError.code === '23505') {
        const { data: raceFolder } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', userId)
          .eq('name', 'home')
          .eq('is_system', true)
          .is('parent_id', null)
          .single();
        
        if (raceFolder) return raceFolder;
      }
      throw new Error(`Failed to create home folder: ${createError.message}`);
    }
    
    return newFolder;
  }

  /**
   * Get or create a system folder by name
   * Used for special folders like "Generated Images"
   * @param userId - User ID
   * @param folderName - Name of the system folder
   * @param parentId - Optional parent folder ID (null for root level)
   * @param parentPath - Optional parent folder path (for constructing full path)
   */
  static async getOrCreateSystemFolder(
    userId: string, 
    folderName: string,
    parentId?: string | null,
    parentPath?: string
  ): Promise<Folder> {
    const supabase = await createClient();
    
    // Build query based on whether parent is specified
    let query = supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .eq('name', folderName)
      .eq('is_system', true);
    
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }
    
    const { data: existing, error: fetchError } = await query.maybeSingle();
    
    if (fetchError) {
      throw new Error(`Failed to check for system folder: ${fetchError.message}`);
    }
    
    if (existing) {
      return existing;
    }
    
    // Calculate path and depth based on parent
    const path = parentPath ? `${parentPath}/${folderName}` : `/${folderName}`;
    const depth = parentPath ? parentPath.split('/').filter(Boolean).length : 0;
    
    const { data: newFolder, error: createError } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        parent_id: parentId || null,
        user_id: userId,
        path,
        depth,
        is_system: true,
      })
      .select()
      .single();
    
    if (createError) {
      // Handle race condition - folder may have been created by another request
      if (createError.code === '23505') {
        let raceQuery = supabase
          .from('folders')
          .select('*')
          .eq('user_id', userId)
          .eq('name', folderName)
          .eq('is_system', true);
        
        if (parentId) {
          raceQuery = raceQuery.eq('parent_id', parentId);
        } else {
          raceQuery = raceQuery.is('parent_id', null);
        }
        
        const { data: raceFolder } = await raceQuery.single();
        if (raceFolder) return raceFolder;
      }
      throw new Error(`Failed to create system folder: ${createError.message}`);
    }
    
    return newFolder;
  }

  /**
   * Get all folders for a user (for server-side hydration)
   * Returns the entire folder tree in a single query
   */
  static async getAllFolders(userId: string): Promise<Folder[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('is_system', { ascending: false })
      .order('depth', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get folders: ${error.message}`);
    }

    return data || [];
  }

  /**
   * List folders at a given level
   */
  static async listFolders(
    userId: string,
    parentId: string | null = null
  ): Promise<Folder[]> {
    const supabase = await createClient();

    let query = supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('is_system', { ascending: false }) // home first
      .order('name', { ascending: true });

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list folders: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get folder by ID
   */
  static async getFolder(userId: string, folderId: string): Promise<Folder | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get folder: ${error.message}`);
    }

    return data;
  }

  /**
   * Get folder breadcrumbs (path from root to folder)
   */
  static async getFolderBreadcrumbs(userId: string, folderId: string): Promise<Folder[]> {
    const supabase = await createClient();
    const breadcrumbs: Folder[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const result = await supabase
        .from('folders')
        .select('*')
        .eq('id', currentId)
        .eq('user_id', userId)
        .single();

      if (result.error || !result.data) break;
      const folder = result.data as Folder;
      breadcrumbs.unshift(folder);
      currentId = folder.parent_id;
    }

    return breadcrumbs;
  }

  /**
   * Create a new folder
   */
  static async createFolder(
    userId: string,
    request: CreateFolderRequest
  ): Promise<Folder> {
    const supabase = await createClient();

    // Normalize folder name (replace whitespace with underscores)
    const folderName = normalizeName(request.name);

    // Calculate path and depth
    let path: string;
    let depth: number;

    if (request.parent_id) {
      const parent = await FolderService.getFolder(userId, request.parent_id);
      if (!parent) throw new Error('Parent folder not found');
      path = `${parent.path}/${folderName}`;
      depth = parent.depth + 1;
    } else {
      path = `/${folderName}`;
      depth = 0;
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        parent_id: request.parent_id,
        user_id: userId,
        path,
        depth,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('A folder with this name already exists');
      }
      throw new Error(`Failed to create folder: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a folder (rename or move)
   */
  static async updateFolder(
    userId: string,
    folderId: string,
    updates: UpdateFolderRequest
  ): Promise<Folder> {
    const supabase = await createClient();

    const folder = await FolderService.getFolder(userId, folderId);
    if (!folder) throw new Error('Folder not found');
    if (folder.is_system) throw new Error('Cannot modify system folders');

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let newPath = folder.path;
    let newDepth = folder.depth;

    // Handle move
    if (updates.parent_id !== undefined && updates.parent_id !== folder.parent_id) {
      if (updates.parent_id) {
        const newParent = await FolderService.getFolder(userId, updates.parent_id);
        if (!newParent) throw new Error('Target folder not found');
        newPath = `${newParent.path}/${updates.name || folder.name}`;
        newDepth = newParent.depth + 1;
      } else {
        newPath = `/${updates.name || folder.name}`;
        newDepth = 0;
      }
      updateData.parent_id = updates.parent_id;
      updateData.path = newPath;
      updateData.depth = newDepth;
    }

    // Handle rename
    if (updates.name && updates.name !== folder.name) {
      const normalizedName = normalizeName(updates.name);
      updateData.name = normalizedName;
      if (updates.parent_id === undefined) {
        // Just rename, keep same parent
        const pathParts = folder.path.split('/');
        pathParts[pathParts.length - 1] = normalizedName;
        updateData.path = pathParts.join('/');
      }
    }

    const { data, error } = await supabase
      .from('folders')
      .update(updateData)
      .eq('id', folderId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update folder: ${error.message}`);
    }

    // Update child paths if folder was moved/renamed
    if (updateData.path && updateData.path !== folder.path) {
      await FolderService.updateChildPaths(userId, folder.path, updateData.path as string);
    }

    return data;
  }

  /**
   * Update paths of all children when parent is moved/renamed
   */
  private static async updateChildPaths(
    userId: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const supabase = await createClient();

    // Get all descendant folders
    const { data: children } = await supabase
      .from('folders')
      .select('id, path')
      .eq('user_id', userId)
      .like('path', `${oldPath}/%`);

    if (!children || children.length === 0) return;

    // Update each child's path
    for (const child of children) {
      const childNewPath = child.path.replace(oldPath, newPath);
      await supabase
        .from('folders')
        .update({ path: childNewPath })
        .eq('id', child.id);
    }
  }

  /**
   * Create a folder tree from a list of paths
   * Used for folder uploads to create the nested structure
   * @returns Map of relative path to folder ID
   */
  static async createFolderTree(
    userId: string,
    parentId: string | null,
    paths: string[]
  ): Promise<Record<string, string>> {
    const supabase = await createClient();
    const folderMap: Record<string, string> = {};
    
    // Get parent folder info for path calculation
    let parentPath = '';
    let parentDepth = -1;
    
    if (parentId) {
      const parent = await FolderService.getFolder(userId, parentId);
      if (!parent) throw new Error('Parent folder not found');
      parentPath = parent.path;
      parentDepth = parent.depth;
    }
    
    // Sort paths by depth to create parents first
    const sortedPaths = [...paths].sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthA - depthB;
    });
    
    // Create folders in order
    for (const relativePath of sortedPaths) {
      const parts = relativePath.split('/');
      const folderName = normalizeName(parts[parts.length - 1]);
      // Normalize entire path for consistency
      const normalizedRelativePath = parts.map(p => normalizeName(p)).join('/');
      const folderDepth = parentDepth + parts.length;
      const fullPath = parentPath ? `${parentPath}/${normalizedRelativePath}` : `/${normalizedRelativePath}`;
      
      // Determine parent: either the direct parent folder or the provided parentId
      let folderParentId = parentId;
      if (parts.length > 1) {
        // Use normalized parent path for lookup
        const parentRelativePath = parts.slice(0, -1).map(p => normalizeName(p)).join('/');
        folderParentId = folderMap[parentRelativePath] || parentId;
      }
      
      // Check if folder already exists
      let existingQuery = supabase
        .from('folders')
        .select('id')
        .eq('user_id', userId)
        .eq('name', folderName);
      
      if (folderParentId) {
        existingQuery = existingQuery.eq('parent_id', folderParentId);
      } else {
        existingQuery = existingQuery.is('parent_id', null);
      }
      
      const { data: existing } = await existingQuery.maybeSingle();
      
      if (existing) {
        folderMap[normalizedRelativePath] = existing.id;
        continue;
      }
      
      // Create folder
      const { data: newFolder, error } = await supabase
        .from('folders')
        .insert({
          name: folderName,
          parent_id: folderParentId,
          user_id: userId,
          path: fullPath,
          depth: folderDepth,
          is_system: false,
        })
        .select()
        .single();
      
      if (error) {
        // Handle duplicate (race condition)
        if (error.code === '23505') {
          let retryQuery = supabase
            .from('folders')
            .select('id')
            .eq('user_id', userId)
            .eq('name', folderName);
          
          if (folderParentId) {
            retryQuery = retryQuery.eq('parent_id', folderParentId);
          } else {
            retryQuery = retryQuery.is('parent_id', null);
          }
          
          const { data: existingAfterError } = await retryQuery.single();
          if (existingAfterError) {
            folderMap[normalizedRelativePath] = existingAfterError.id;
            continue;
          }
        }
        throw new Error(`Failed to create folder ${folderName}: ${error.message}`);
      }
      
      folderMap[normalizedRelativePath] = newFolder.id;
    }
    
    return folderMap;
  }

  /**
   * Delete a folder and all contents
   */
  static async deleteFolder(userId: string, folderId: string): Promise<void> {
    const supabase = await createClient();
    const storageService = new StorageService(supabase);

    const folder = await FolderService.getFolder(userId, folderId);
    if (!folder) throw new Error('Folder not found');
    if (folder.is_system) throw new Error('Cannot delete system folders');

    // Get all assets in folder and subfolders to delete from storage
    const { data: assets } = await supabase
      .from('assets')
      .select('storage_path')
      .eq('user_id', userId)
      .eq('folder_id', folderId);

    // Get subfolder assets too
    const { data: subfolders } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .like('path', `${folder.path}/%`);

    if (subfolders && subfolders.length > 0) {
      const { data: subAssets } = await supabase
        .from('assets')
        .select('storage_path')
        .eq('user_id', userId)
        .in('folder_id', subfolders.map(f => f.id));

      if (subAssets) {
        assets?.push(...subAssets);
      }
    }

    // Delete files from storage
    if (assets && assets.length > 0) {
      await storageService.deleteFiles(assets.map(a => a.storage_path));
    }

    // Delete folder (cascades to assets and subfolders)
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  }
}
