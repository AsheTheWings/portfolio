/**
 * /api/library/upload - Upload a new asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, AllowedMimeType } from '@/features/library';
import { AssetService } from '@/features/library/services/asset.service';
import { FolderService } from '@/features/library/services/folder.service';
import { TagService } from '@/features/library/services/tag.service';
import { StorageService } from '@/features/library/services/storage.service';
import { createClient } from '@/lib/supabase/server';

import type { Tag } from '@/features/library/types';

/**
 * POST /api/library/upload - Upload a file and create asset record
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const supabase = await createClient();
    const storageService = new StorageService(supabase);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;
    const thumbnail = formData.get('thumbnail') as File | null; // Optional video thumbnail
    const altText = formData.get('altText') as string | null;
    const tagsJson = formData.get('tags') as string | null;
    const metadataJson = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get folder - use home folder if not specified
    let targetFolderId = folderId;
    if (!targetFolderId) {
      const homeFolder = await FolderService.getHomeFolder(user.id);
      targetFolderId = homeFolder.id;
    } else {
      // Verify folder exists and belongs to user
      const folder = await FolderService.getFolder(user.id, targetFolderId);
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Generate asset ID
    const assetId = crypto.randomUUID();

    // Upload to storage
    const uploadResult = await storageService.uploadFile(user.id, assetId, file);

    // Upload thumbnail if provided (for videos)
    let thumbnailPath: string | undefined;
    if (thumbnail && file.type.startsWith('video/')) {
      const thumbResult = await storageService.uploadFile(user.id, assetId, thumbnail);
      thumbnailPath = thumbResult.path;
    }

    // Extract just the filename (strip any path components)
    // Some browsers/dropzones include path in file.name for folder uploads
    const fileName = file.name.includes('/') 
      ? file.name.split('/').pop()! 
      : file.name;

    // Create asset record
    const asset = await AssetService.createAsset(user.id, {
      folderId: targetFolderId,
      fileName: fileName,
      storagePath: uploadResult.path,
      mimeType: file.type,
      sizeKb: Math.ceil(file.size / 1024),
      altText: altText || undefined,
      metadata: metadataJson ? JSON.parse(metadataJson) : undefined,
      thumbnail_path: thumbnailPath,
    });

    // Set tags if provided
    let tags: Tag[] = [];
    if (tagsJson) {
      const tagNames = JSON.parse(tagsJson) as string[];
      if (tagNames.length > 0) {
        tags = await TagService.setAssetTags(user.id, asset.id, tagNames);
      }
    }

    return NextResponse.json({ asset: { ...asset, tags } });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ status: 'error', message: errorMessage }, { status: 500 });
  }
}
