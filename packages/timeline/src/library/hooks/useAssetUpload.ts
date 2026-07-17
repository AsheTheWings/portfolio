'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { agentimeHttp } from '../../agent/lib/agentime-client';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Asset, UploadAssetRequest } from '../types';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, type AllowedMimeType } from '../types';

export function useAssetUpload() {
  const { mutate } = useSWRConfig();
  const currentFolderId = useLibraryStore((state) => state.currentFolderId);
  const homeFolder = useLibraryStore((state) => state.homeFolder);
  const setError = useLibraryStore((state) => state.setError);
  const addUploadingFile = useLibraryStore((state) => state.addUploadingFile);
  const updateUploadingFile = useLibraryStore((state) => state.updateUploadingFile);

  const uploadAsset = useCallback(async (request: UploadAssetRequest): Promise<Asset | null> => {
    const { file, folderId, altText, tags } = request;
    let targetFolderId = folderId || currentFolderId || homeFolder?.id;

    if (!targetFolderId) {
      try {
        const folders = await agentimeHttp.listLibraryFolders();
        targetFolderId = folders.find((folder) => folder.isSystem && folder.name === 'home')?.id;
        void mutate('agentime:library:folders', folders, { revalidate: false });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load the library home folder');
        return null;
      }
    }
    if (!targetFolderId) {
      setError('The library home folder is unavailable');
      return null;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      setError(`File type ${file.type} is not supported`);
      return null;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
      return null;
    }

    const uploadId = `upload-${crypto.randomUUID()}`;
    addUploadingFile({
      id: uploadId,
      file,
      progress: 5,
      status: 'uploading',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      folderId: targetFolderId,
    });

    try {
      const asset = await agentimeHttp.uploadLibraryAsset({
        file,
        fileName: file.name,
        folderId: targetFolderId,
        altText,
        tags,
      });
      updateUploadingFile(uploadId, {
        progress: 100,
        status: 'completed',
        finalAssetId: asset.id,
      });
      void mutate((key) => typeof key === 'string' && key.startsWith('agentime:library:assets:'));
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      updateUploadingFile(uploadId, { status: 'error', error: message });
      setError(message);
      return null;
    }
  }, [addUploadingFile, currentFolderId, homeFolder?.id, mutate, setError, updateUploadingFile]);

  const uploadAssets = useCallback(async (files: File[], folderId?: string): Promise<void> => {
    await Promise.all(files.map((file) => uploadAsset({ file, folderId: folderId ?? '' })));
  }, [uploadAsset]);

  return { uploadAsset, uploadAssets };
}
