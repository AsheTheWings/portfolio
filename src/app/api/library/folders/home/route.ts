/**
 * /api/library/folders/home - Get user's home folder
 */

import { NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { FolderService } from '@/features/library/services/folder.service';

/**
 * GET /api/library/folders/home - Get or create user's home folder
 */
export async function GET() {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const folder = await FolderService.getHomeFolder(user.id);
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
