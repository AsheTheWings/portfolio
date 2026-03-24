/**
 * /api/library/assets/[id]/url - Refresh signed URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/library/assets/[id]/url - Get a fresh signed URL
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;

    const url = await AssetService.refreshAssetUrl(user.id, id);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : message === 'Asset not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
