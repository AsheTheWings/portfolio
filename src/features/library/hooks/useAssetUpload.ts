'use client';

/**
 * useAssetUpload - Handles file uploads with progress tracking
 * Uses XMLHttpRequest for real-time progress updates
 */

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Asset, UploadAssetRequest } from '../types';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, AllowedMimeType } from '../types';
import { extractVideoThumbnail, createThumbnailFile } from '../utils';

export function useAssetUpload() {
  const { mutate } = useSWRConfig();
  
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const setError = useLibraryStore((state) => state.setError);
  const addUploadingFile = useLibraryStore((state) => state.addUploadingFile);
  const updateUploadingFile = useLibraryStore((state) => state.updateUploadingFile);

  /**
   * Upload a file with real-time progress tracking using XMLHttpRequest
   */
  const uploadAsset = useCallback(async (request: UploadAssetRequest): Promise<Asset | null> => {
    const { file, folderId, altText, tags, metadata } = request;

    // Determine target folder:
    // 1. Use explicit folderId if provided
    // 2. Use current folder if navigated into one
    // 3. Fall back to home folder (fetch/create if missing)
    let targetFolderId = folderId || currentFolderId || homeFolder?.id;

    // Ensure home folder exists - all files must belong to a folder
    if (!targetFolderId) {
      try {
        const res = await fetch('/api/library/folders/home');
        if (res.ok) {
          const { folder } = await res.json();
          targetFolderId = folder.id;
          // Trigger SWR to sync folders to store (background, no await)
          mutate('/api/library/folders?all=true');
        } else {
          setError('Failed to get home folder');
          return null;
        }
      } catch {
        setError('Failed to get home folder');
        return null;
      }
    }

    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      setError(`File type ${file.type} is not supported`);
      return null;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
      return null;
    }

    // Generate preview URL for images
    let previewUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    // Add to uploading queue
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    addUploadingFile({
      id: uploadId,
      file,
      progress: 0,
      status: 'uploading',
      previewUrl,
      folderId: targetFolderId || undefined,
    });

    // Extract thumbnail for videos
    let thumbnailFile: File | null = null;
    if (file.type.startsWith('video/')) {
      try {
        updateUploadingFile(uploadId, { progress: 2 }); // Show extraction started
        const thumbResult = await extractVideoThumbnail(file);
        thumbnailFile = createThumbnailFile(thumbResult.blob, file.name);
        updateUploadingFile(uploadId, { progress: 5 }); // Extraction complete
      } catch (err) {
        console.warn('Failed to extract video thumbnail:', err);
        // Continue without thumbnail - will use placeholder
      }
    }

    // Build form data
    const formData = new FormData();
    formData.append('file', file);
    if (targetFolderId) formData.append('folderId', targetFolderId);
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
    if (altText) formData.append('altText', altText);
    if (tags) formData.append('tags', JSON.stringify(tags));
    if (metadata) formData.append('metadata', JSON.stringify(metadata));

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateUploadingFile(uploadId, { progress: percent });
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const asset = response.asset;

            // Mark upload as completed with finalAssetId - card stays visible until SWR data arrives
            updateUploadingFile(uploadId, { 
              progress: 100, 
              status: 'completed',
              finalAssetId: asset.id,
            });

            // Revalidate assets - SWR will fetch and AssetGrid will filter out this upload card
            mutate((key) => typeof key === 'string' && key.startsWith('/api/library/assets'));

            resolve(asset);
          } catch {
            updateUploadingFile(uploadId, {
              status: 'error',
              error: 'Invalid server response',
            });
            resolve(null);
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.error || errorMessage;
          } catch {
            // Use default error message
          }
          updateUploadingFile(uploadId, {
            status: 'error',
            error: errorMessage,
          });
          resolve(null);
        }
      };

      // Handle network errors
      xhr.onerror = () => {
        updateUploadingFile(uploadId, {
          status: 'error',
          error: 'Network error',
        });
        resolve(null);
      };

      // Handle abort
      xhr.onabort = () => {
        updateUploadingFile(uploadId, {
          status: 'error',
          error: 'Upload cancelled',
        });
        resolve(null);
      };

      // Send request
      xhr.open('POST', '/api/library/upload');
      xhr.send(formData);
    });
  }, [mutate, addUploadingFile, updateUploadingFile, setError, currentFolderId, homeFolder]);

  /**
   * Upload multiple files in parallel
   * All files are added to queue immediately, then uploaded concurrently
   * @param files - Files to upload
   * @param folderId - Optional folder ID (uses current folder or home if not specified)
   */
  const uploadAssets = useCallback(async (files: File[], folderId?: string): Promise<void> => {
    // Start all uploads in parallel (don't await sequentially)
    await Promise.all(files.map(file => uploadAsset({ file, folderId: folderId || '' })));
  }, [uploadAsset]);

  return {
    uploadAsset,
    uploadAssets,
  };
}
