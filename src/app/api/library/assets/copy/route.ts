/**
 * /api/library/assets/copy - Bulk copy assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';

/**
 * POST /api/library/assets/copy - Copy asset(s) to a folder
 * Body: { ids: string[], folderId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    
    if (!body.folderId) {
      return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
    }

    const result = await AssetService.copyAssets(user.id, body.ids, body.folderId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
