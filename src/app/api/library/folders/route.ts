/**
 * /api/library/folders - List and create folders
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { FolderService } from '@/features/library/services/folder.service';

/**
 * GET /api/library/folders - List folders
 * Query params:
 * - all: 'true' - Return all folders (for SWR hydration)
 * - parentId: string | 'null' - Parent folder ID (null for top-level)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { searchParams } = new URL(request.url);
    
    // If 'all' param is true, return complete folder tree
    if (searchParams.get('all') === 'true') {
      const folders = await FolderService.getAllFolders(user.id);
      return NextResponse.json({ folders });
    }
    
    // Otherwise, return folders at specific level
    const parentIdParam = searchParams.get('parentId');
    const parentId = parentIdParam === 'null' || parentIdParam === null 
      ? null 
      : parentIdParam;

    const folders = await FolderService.listFolders(user.id, parentId);
    return NextResponse.json({ folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/library/folders - Create folder(s)
 * 
 * Single folder: { name: string, parentId: string | null }
 * Bulk creation: { paths: string[], parentId: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();

    const { name, parentId, paths } = body;

    // Bulk creation mode
    if (paths && Array.isArray(paths)) {
      // Validate paths
      for (const path of paths) {
        if (typeof path !== 'string' || path.length === 0) {
          return NextResponse.json({ error: 'Invalid path in paths array' }, { status: 400 });
        }
        // Check each segment for invalid chars
        const segments = path.split('/');
        for (const segment of segments) {
          if (/[\\:*?"<>|]/.test(segment)) {
            return NextResponse.json({ error: `Invalid folder name in path: ${path}` }, { status: 400 });
          }
        }
      }

      const folderMap = await FolderService.createFolderTree(
        user.id,
        parentId || null,
        paths
      );

      // Fetch all created folders to return
      const allFolders = await FolderService.getAllFolders(user.id);
      const createdFolders = allFolders.filter(f => Object.values(folderMap).includes(f.id));

      return NextResponse.json({ folderMap, folders: createdFolders }, { status: 201 });
    }

    // Single folder creation mode
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    if (name.length > 255) {
      return NextResponse.json({ error: 'Folder name too long' }, { status: 400 });
    }

    // Validate folder name (no slashes or special chars)
    if (/[\/\\:*?"<>|]/.test(name)) {
      return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
    }

    const folder = await FolderService.createFolder(user.id, {
      name: name.trim(),
      parentId: parentId || null,
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 
      : message.includes('already exists') ? 409 
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
