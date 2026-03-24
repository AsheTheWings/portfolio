/**
 * Asset Service - Handles asset CRUD operations
 */

import { createClient } from '@/lib/supabase/server';
import { StorageService } from './storage.service';
import { TagService } from './tag.service';
import type { Asset, Tag, Folder, AssetWithTagsJoin, AssetItemTagJoin, ListAssetsParams, UpdateAssetRequest } from '../types';
import { getFileTypeFromMime as getFileType, normalizeName } from '../types';

export class AssetService {
  /**
   * List assets with optional filtering
   */
  static async listAssets(
    userId: string,
    params: ListAssetsParams = {}
  ): Promise<{ assets: Asset[]; total: number }> {
    const supabase = await createClient();
    const {
      folder_id,
      file_type,
      tag,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = params;

    // Base query - use left join (no !inner) to include assets without tags
    let query = supabase
      .from('assets')
      .select(`
        *,
        asset_item_tags (
          asset_tags (
            id,
            tag,
            user_id,
            created_at,
            updated_at
          )
        )
      `, { count: 'exact' })
      .eq('user_id', userId);

    // Filter by folder
    if (folder_id) {
      // Inside a folder - show assets in that folder
      query = query.eq('folder_id', folder_id);
    } else {
      // At root - show only assets without a folder (unorganized)
      query = query.is('folder_id', null);
    }

    // Apply filters
    if (file_type) {
      query = query.eq('file_type', file_type);
    }

    if (search) {
      query = query.or(`file_name.ilike.%${search}%,alt_text.ilike.%${search}%`);
    }

    // Sort (no pagination - client-side pagination used)
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list assets: ${error.message}`);
    }

    // Transform data to flatten tags
    const assets: Asset[] = (data || []).map((asset: Asset & AssetWithTagsJoin) => ({
      ...asset,
      tags: asset.asset_item_tags?.map((ait: AssetItemTagJoin) => ait.asset_tags) || [],
      asset_item_tags: undefined,
    }));

    // If filtering by tag, do it client-side (Supabase join filtering is complex)
    const filteredAssets = tag
      ? assets.filter(a => a.tags?.some(t => t.tag === tag))
      : assets;

    return {
      assets: filteredAssets,
      total: count || 0,
    };
  }

  /**
   * Search assets globally (across all folders)
   * Joins with folders to include folder path for each asset
   */
  static async searchAssets(
    userId: string,
    searchQuery: string,
    limit: number = 10
  ): Promise<Asset[]> {
    if (!searchQuery.trim()) return [];
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        folders (
          id,
          name,
          path,
          parent_id,
          depth,
          is_system,
          assets_count,
          created_at,
          updated_at
        ),
        asset_item_tags (
          asset_tags (
            id,
            tag,
            user_id,
            created_at,
            updated_at
          )
        )
      `)
      .eq('user_id', userId)
      .or(`file_name.ilike.%${searchQuery}%,alt_text.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search assets: ${error.message}`);
    }

    return (data || []).map((asset: Asset & AssetWithTagsJoin & { folders?: Folder }) => ({
      ...asset,
      folder: asset.folders || undefined,
      folders: undefined,
      tags: asset.asset_item_tags?.map((ait: AssetItemTagJoin) => ait.asset_tags) || [],
      asset_item_tags: undefined,
    }));
  }

  /**
   * Get a single asset by ID
   */
  static async getAsset(userId: string, assetId: string): Promise<Asset | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        asset_item_tags (
          asset_tags (
            id,
            tag,
            user_id,
            created_at,
            updated_at
          )
        )
      `)
      .eq('id', assetId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get asset: ${error.message}`);
    }

    return {
      ...data,
      tags: data.asset_item_tags?.map((ait: AssetItemTagJoin) => ait.asset_tags) || [],
      asset_item_tags: undefined,
    } as Asset;
  }

  /**
   * Get multiple assets by IDs (internal server-side use)
   * Supports both asset IDs and folder IDs - folders are resolved to all descendant assets
   * Does not filter by user - caller must ensure IDs are authorized
   */
  static async getAssetsByIds(ids: string[]): Promise<Array<{
    id: string;
    url: string;
    mime_type: string;
    file_name: string;
  }>> {
    if (!ids || ids.length === 0) return [];
    
    const supabase = await createClient();
    
    // Check which IDs are folders
    const { data: folders } = await supabase
      .from('folders')
      .select('id')
      .in('id', ids);
    
    const folderIds = new Set(folders?.map(f => f.id) || []);
    const assetIds = ids.filter(id => !folderIds.has(id));
    
    // Collect all asset IDs to fetch
    const allAssetIds = new Set(assetIds);
    
    // For each folder, get all descendant assets recursively
    if (folderIds.size > 0) {
      // Get all subfolders recursively using a recursive CTE
      const { data: allFolderIds } = await supabase.rpc('get_descendant_folder_ids', {
        root_folder_ids: Array.from(folderIds)
      });
      
      // Combine root folders + descendants
      const allFolders = [...folderIds, ...(allFolderIds?.map((r: { id: string }) => r.id) || [])];
      
      // Get all assets in these folders
      const { data: folderAssets } = await supabase
        .from('assets')
        .select('id')
        .in('folder_id', allFolders);
      
      folderAssets?.forEach(a => allAssetIds.add(a.id));
    }
    
    if (allAssetIds.size === 0) return [];
    
    // Fetch all assets
    const { data, error } = await supabase
      .from('assets')
      .select('id, url, mime_type, file_name')
      .in('id', Array.from(allAssetIds));

    if (error) {
      throw new Error(`Failed to get assets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get library paths for assets by IDs.
   * Returns folder.path + "/" + file_name for each asset.
   */
  static async getAssetPaths(ids: string[]): Promise<Array<{ id: string; path: string }>> {
    if (!ids || ids.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assets')
      .select('id, file_name, folder_id')
      .in('id', ids);

    if (error || !data?.length) {
      console.error('Failed to get asset paths:', error);
      return [];
    }

    // Fetch folder paths for all unique folder IDs
    const folderIds = [...new Set(data.map(a => a.folder_id).filter(Boolean))];
    if (folderIds.length === 0) return [];

    const { data: folders } = await supabase
      .from('folders')
      .select('id, path')
      .in('id', folderIds);

    const folderPathMap = new Map((folders || []).map((f: { id: string; path: string }) => [f.id, f.path]));

    return data
      .filter(row => folderPathMap.has(row.folder_id))
      .map(row => ({
        id: row.id,
        path: `${folderPathMap.get(row.folder_id)}/${row.file_name}`,
      }));
  }

  /**
   * Get multiple assets by IDs with full data including tags and folder
   * Filters by user_id for security
   */
  static async getAssetsByIdsWithTags(userId: string, ids: string[]): Promise<Asset[]> {
    if (!ids || ids.length === 0) return [];
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        folder:folders (
          id,
          name,
          path
        ),
        asset_item_tags (
          asset_tags (
            id,
            tag,
            user_id,
            created_at,
            updated_at
          )
        )
      `)
      .in('id', ids)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get assets: ${error.message}`);
    }

    return (data || []).map((asset: Asset & AssetWithTagsJoin & { folder?: Folder }) => ({
      ...asset,
      tags: asset.asset_item_tags?.map((ait: AssetItemTagJoin) => ait.asset_tags) || [],
      asset_item_tags: undefined,
    }));
  }

  /**
   * Normalize file name while preserving extension
   */
  private static normalizeFileName(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension
      return normalizeName(fileName);
    }
    const baseName = fileName.substring(0, lastDotIndex);
    const extension = fileName.substring(lastDotIndex);
    return normalizeName(baseName) + extension;
  }

  /**
   * Create a new asset record (after file upload)
   */
  static async createAsset(
    userId: string,
    data: {
      folder_id?: string | null;
      file_name: string;
      storage_path: string;
      mime_type: string;
      size_kb: number;
      alt_text?: string;
      metadata?: Record<string, unknown>;
      thumbnail_path?: string;
    }
  ): Promise<Asset> {
    const supabase = await createClient();
    const storageService = new StorageService(supabase);

    // Normalize file name (replace whitespace with underscores)
    const normalizedFileName = AssetService.normalizeFileName(data.file_name);

    // Get signed URL for the asset
    const { signedUrl } = await storageService.getSignedUrl(data.storage_path);

    // Get thumbnail URL
    let thumbnailUrl: string | null = null;
    if (data.thumbnail_path) {
      // Video: use uploaded thumbnail
      const { signedUrl: thumbUrl } = await storageService.getSignedUrl(data.thumbnail_path);
      thumbnailUrl = thumbUrl;
    } else if (data.mime_type.startsWith('image/')) {
      // Image: use Supabase transform
      const { signedUrl: thumbUrl } = await storageService.getTransformedUrl(
        data.storage_path,
        { width: 200, height: 200, quality: 80 }
      );
      thumbnailUrl = thumbUrl;
    }

    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        folder_id: data.folder_id || null,
        file_name: normalizedFileName,
        storage_path: data.storage_path,
        url: signedUrl,
        file_type: getFileType(data.mime_type),
        mime_type: data.mime_type,
        size_kb: data.size_kb,
        alt_text: data.alt_text || null,
        thumbnail_url: thumbnailUrl,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create asset: ${error.message}`);
    }

    return asset;
  }

  /**
   * Create an asset from base64 image data (for AI-generated images)
   * Uploads to storage and creates the asset record
   */
  static async createAssetFromBase64(
    userId: string,
    folderId: string,
    base64Data: string,
    mimeType: string,
    fileName?: string
  ): Promise<Asset> {
    const supabase = await createClient();
    const storageService = new StorageService(supabase);
    
    // Generate asset ID and file name (normalized)
    const assetId = crypto.randomUUID();
    const extension = mimeType.split('/')[1] || 'png';
    const rawFileName = fileName || `generated_${Date.now()}.${extension}`;
    const finalFileName = AssetService.normalizeFileName(rawFileName);
    
    // Convert base64 to Blob
    const binaryData = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binaryData], { type: mimeType });
    const sizeKb = Math.ceil(binaryData.length / 1024);
    
    // Upload to storage
    const uploadResult = await storageService.uploadBlob(
      userId,
      assetId,
      blob,
      finalFileName,
      mimeType
    );
    
    // Get signed URL
    const { signedUrl } = await storageService.getSignedUrl(uploadResult.path);
    
    // Get thumbnail URL for images
    let thumbnailUrl: string | null = null;
    if (mimeType.startsWith('image/')) {
      const { signedUrl: thumbUrl } = await storageService.getTransformedUrl(
        uploadResult.path,
        { width: 200, height: 200, quality: 80 }
      );
      thumbnailUrl = thumbUrl;
    }
    
    // Create asset record
    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        folder_id: folderId,
        file_name: finalFileName,
        storage_path: uploadResult.path,
        url: signedUrl,
        file_type: getFileType(mimeType),
        mime_type: mimeType,
        size_kb: sizeKb,
        alt_text: 'AI generated image',
        thumbnail_url: thumbnailUrl,
        metadata: { source: 'agent-generated' },
      })
      .select()
      .single();
    
    if (error) {
      // Clean up uploaded file if record creation fails
      await storageService.deleteFile(uploadResult.path);
      throw new Error(`Failed to create asset: ${error.message}`);
    }
    
    return asset;
  }

  /**
   * Update an asset
   */
  static async updateAsset(
    userId: string,
    assetId: string,
    updates: UpdateAssetRequest
  ): Promise<Asset> {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.file_name !== undefined) {
      updateData.file_name = AssetService.normalizeFileName(updates.file_name);
    }

    if (updates.alt_text !== undefined) {
      updateData.alt_text = updates.alt_text;
    }

    if (updates.folder_id !== undefined) {
      updateData.folder_id = updates.folder_id;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata;
    }

    const { data, error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update asset: ${error.message}`);
    }

    // Handle tags update separately
    if (updates.tags !== undefined) {
      await TagService.setAssetTags(userId, assetId, updates.tags);
    }

    return data;
  }

  /**
   * Delete asset(s) and their files from storage
   * Accepts single ID or array of IDs
   */
  static async deleteAsset(
    userId: string,
    assetIds: string | string[]
  ): Promise<{ deleted: string[]; failed: string[] }> {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    const supabase = await createClient();
    const storageService = new StorageService(supabase);
    
    const deleted: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      ids.map(async (assetId) => {
        try {
          // Get asset to find storage path
          const asset = await AssetService.getAsset(userId, assetId);
          if (!asset) {
            failed.push(assetId);
            return;
          }

          // Delete from storage first
          await storageService.deleteFile(asset.storage_path);

          // Delete asset record (cascade deletes asset_item_tags)
          const { error } = await supabase
            .from('assets')
            .delete()
            .eq('id', assetId)
            .eq('user_id', userId);

          if (error) {
            failed.push(assetId);
          } else {
            deleted.push(assetId);
          }
        } catch {
          failed.push(assetId);
        }
      })
    );

    return { deleted, failed };
  }

  /**
   * Copy an asset to a different folder
   */
  static async copyAsset(
    userId: string,
    assetId: string,
    targetFolderId: string | null
  ): Promise<Asset> {
    const supabase = await createClient();
    const storageService = new StorageService(supabase);

    // Get the original asset
    const originalAsset = await AssetService.getAsset(userId, assetId);
    if (!originalAsset) {
      throw new Error('Asset not found');
    }

    // Generate new asset ID and storage path
    const newAssetId = crypto.randomUUID();
    const originalPath = originalAsset.storage_path;
    const pathParts = originalPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const newStoragePath = `${userId}/${newAssetId}/${fileName}`;

    // Copy file in storage
    const { error: copyError } = await supabase.storage
      .from('assets')
      .copy(originalPath, newStoragePath);

    if (copyError) {
      throw new Error(`Failed to copy file: ${copyError.message}`);
    }

    // Get signed URLs for the new file
    const { signedUrl } = await storageService.getSignedUrl(newStoragePath);
    let thumbnailUrl: string | null = null;

    if (originalAsset.mime_type?.startsWith('image/')) {
      const { signedUrl: thumbUrl } = await storageService.getTransformedUrl(
        newStoragePath,
        { width: 200, height: 200, quality: 80 }
      );
      thumbnailUrl = thumbUrl;
    }

    // Create new asset record
    const { data: newAsset, error: insertError } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        folder_id: targetFolderId,
        file_name: originalAsset.file_name,
        storage_path: newStoragePath,
        url: signedUrl,
        file_type: originalAsset.file_type,
        mime_type: originalAsset.mime_type,
        size_kb: originalAsset.size_kb,
        alt_text: originalAsset.alt_text,
        thumbnail_url: thumbnailUrl,
        metadata: originalAsset.metadata,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up copied file if record creation fails
      await storageService.deleteFile(newStoragePath);
      throw new Error(`Failed to create asset copy: ${insertError.message}`);
    }

    // Copy tags
    if (originalAsset.tags && originalAsset.tags.length > 0) {
      const tagNames = originalAsset.tags.map(t => t.tag);
      await TagService.setAssetTags(userId, newAsset.id, tagNames);
    }

    // Return with tags
    return AssetService.getAsset(userId, newAsset.id) as Promise<Asset>;
  }

  /**
   * Copy multiple assets to a folder (bulk operation)
   */
  static async copyAssets(
    userId: string,
    assetIds: string | string[],
    targetFolderId: string
  ): Promise<{ copied: string[]; failed: string[] }> {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    const copied: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      ids.map(async (id) => {
        try {
          await AssetService.copyAsset(userId, id, targetFolderId);
          copied.push(id);
        } catch {
          failed.push(id);
        }
      })
    );

    return { copied, failed };
  }

  /**
   * Move asset(s) to a different folder (metadata update only - no storage I/O)
   */
  static async moveAsset(
    userId: string,
    assetIds: string | string[],
    targetFolderId: string | null
  ): Promise<{ moved: string[]; failed: string[] }> {
    const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('assets')
      .update({ folder_id: targetFolderId })
      .in('id', ids)
      .eq('user_id', userId)
      .select('id');

    if (error) {
      return { moved: [], failed: ids };
    }

    const movedIds = data?.map(a => a.id) || [];
    const failedIds = ids.filter(id => !movedIds.includes(id));

    return { moved: movedIds, failed: failedIds };
  }

  /**
   * Get a fresh signed URL for an asset
   */
  static async refreshAssetUrl(userId: string, assetId: string): Promise<string> {
    const supabase = await createClient();
    const storageService = new StorageService(supabase);

    const asset = await AssetService.getAsset(userId, assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    const { signedUrl } = await storageService.getSignedUrl(asset.storage_path);

    // Update stored URL
    await supabase
      .from('assets')
      .update({ url: signedUrl, updated_at: new Date().toISOString() })
      .eq('id', assetId);

    return signedUrl;
  }
}
