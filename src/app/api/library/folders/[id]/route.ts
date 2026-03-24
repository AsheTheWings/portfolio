/**
 * /api/library/folders/[id] - Get, update, delete a folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { FolderService } from '@/features/library/services/folder.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/library/folders/:id - Get folder details with breadcrumbs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;

    const folder = await FolderService.getFolder(user.id, id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const breadcrumbs = await FolderService.getFolderBreadcrumbs(user.id, id);
    const subfolders = await FolderService.listFolders(user.id, id);

    return NextResponse.json({ folder, breadcrumbs, subfolders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/library/folders/:id - Update folder (rename or move)
 * Body: { name?: string, parent_id?: string | null }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;
    const body = await request.json();

    const { name, parent_id } = body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
      }
      if (/[\/\\:*?"<>|]/.test(name)) {
        return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
      }
    }

    const folder = await FolderService.updateFolder(user.id, id, {
      name: name?.trim(),
      parent_id,
    });

    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 
      : message === 'Folder not found' ? 404
      : message.includes('system folders') ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/library/folders/:id - Delete folder and all contents
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { id } = await params;

    await FolderService.deleteFolder(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 
      : message === 'Folder not found' ? 404
      : message.includes('system folders') ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
