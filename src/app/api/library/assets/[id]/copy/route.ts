/**
 * /api/library/assets/[id]/copy - Copy an asset to a folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';
import { FolderService } from '@/features/library/services/folder.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/library/assets/:id/copy - Copy asset to target folder
 * Body: { folder_id: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;
    const body = await request.json();

    const { folder_id } = body;
    if (!folder_id) {
      return NextResponse.json({ error: 'Target folder_id is required' }, { status: 400 });
    }

    // Verify target folder exists
    const targetFolder = await FolderService.getFolder(user.id, folder_id);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
    }

    // Copy the asset
    const asset = await AssetService.copyAsset(user.id, id, folder_id);

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Copy failed';
    const status = message === 'Unauthorized' ? 401 
      : message === 'Asset not found' ? 404 
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
