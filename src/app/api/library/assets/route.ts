/**
 * /api/library/assets - List assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';
import type { ListAssetsParams, AssetFileType } from '@/features/library';

/**
 * GET /api/library/assets - List assets with optional filtering
 * Supports: folderId, fileType, tag, search, sortBy, sortOrder
 * Or: ids[] to fetch specific assets by ID
 */
export async function GET(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { searchParams } = new URL(request.url);

    // Check if fetching by IDs
    const ids = searchParams.getAll('ids');
    if (ids.length > 0) {
      const assets = await AssetService.getAssetsByIdsWithTags(user.id, ids);
      return NextResponse.json({ assets, total: assets.length });
    }

    const params: ListAssetsParams = {
      folderId: searchParams.get('folderId') || undefined,
      fileType: searchParams.get('fileType') as AssetFileType | undefined,
      tag: searchParams.get('tag') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as ListAssetsParams['sortBy']) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const result = await AssetService.listAssets(user.id, params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/library/assets - Move asset(s) to a folder
 * Body: { ids: string[], folderId: string | null }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    
    // folderId can be null (move to root) or string
    if (body.folderId === undefined) {
      return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
    }

    const result = await AssetService.moveAsset(user.id, body.ids, body.folderId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/library/assets - Delete asset(s)
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const result = await AssetService.deleteAsset(user.id, body.ids);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
