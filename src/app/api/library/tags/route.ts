/**
 * /api/library/tags - List user tags
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { TagService } from '@/features/library/services/tag.service';

/**
 * GET /api/library/tags - List all tags for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const tags = await TagService.listTags(user.id);
    return NextResponse.json(tags);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
