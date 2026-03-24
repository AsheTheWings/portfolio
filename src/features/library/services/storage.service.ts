/**
 * Supabase Storage service for asset file operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorageUploadResult, SignedUrlResponse } from '../types';

const BUCKET_NAME = 'assets';
const SIGNED_URL_EXPIRY = 604800; // 7 days (1 week)

export class StorageService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upload a file to storage
   * Path format: {userId}/{asset_id}/{filename}
   */
  async uploadFile(
    userId: string,
    assetId: string,
    file: File
  ): Promise<StorageUploadResult> {
    const storagePath = `${userId}/${assetId}/${file.name}`;

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      path: data.path,
      id: data.id,
      fullPath: data.fullPath,
    };
  }

  /**
   * Upload a blob to storage (for generated content)
   * Path format: {userId}/{asset_id}/{filename}
   */
  async uploadBlob(
    userId: string,
    assetId: string,
    blob: Blob,
    fileName: string,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const storagePath = `${userId}/${assetId}/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      path: data.path,
      id: data.id,
      fullPath: data.fullPath,
    };
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedUrl(storagePath: string): Promise<SignedUrlResponse> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString();

    return {
      signedUrl: data.signedUrl,
      expiresAt,
    };
  }

  /**
   * Get signed URL with image transformation (thumbnails)
   */
  async getTransformedUrl(
    storagePath: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
    }
  ): Promise<SignedUrlResponse> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY, {
        transform: {
          width: options.width || 200,
          height: options.height || 200,
          resize: 'cover',
          quality: options.quality || 80,
        },
      });

    if (error) {
      throw new Error(`Failed to create transformed URL: ${error.message}`);
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString();

    return {
      signedUrl: data.signedUrl,
      expiresAt,
    };
  }

  /**
   * Download a file
   */
  async downloadFile(storagePath: string): Promise<Blob> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      throw new Error(`Download failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from storage
   */
  async deleteFiles(storagePaths: string[]): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove(storagePaths);

    if (error) {
      throw new Error(`Batch delete failed: ${error.message}`);
    }
  }

  /**
   * List files in a user's folder
   */
  async listUserFiles(userId: string, folder?: string) {
    const path = folder ? `${userId}/${folder}` : userId;

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .list(path, {
        limit: 100,
        sortBy: { column: 'createdAt', order: 'desc' },
      });

    if (error) {
      throw new Error(`List files failed: ${error.message}`);
    }

    return data;
  }
}
