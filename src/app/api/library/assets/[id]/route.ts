/**
 * /api/library/assets/[id] - Single asset operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/library/assets/[id] - Get a single asset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;

    const asset = await AssetService.getAsset(user.id, id);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/library/assets/[id] - Update an asset
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;
    const body = await request.json();

    const asset = await AssetService.updateAsset(user.id, id, body);
    return NextResponse.json(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/library/assets/[id] - Delete an asset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;

    await AssetService.deleteAsset(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : message === 'Asset not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
