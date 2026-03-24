/**
 * Library Search API
 * GET /api/library/search?q=query
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { AssetService } from '@/features/library/services/asset.service';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query.trim()) {
      return NextResponse.json({ assets: [] });
    }

    const assets = await AssetService.searchAssets(user.id, query, limit);

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Search error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    );
  }
}
