import type { LibraryAsset, LibraryFolder } from '@agentime/protocol';
import { agentimeHttp } from '../../agent/lib/agentime-client';
import type { FolderTreeNode, LibraryItem } from '../types';

export function normalizeLibraryPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export async function listAllLibraryAssets(input: { folderId?: string; search?: string } = {}): Promise<LibraryAsset[]> {
  const assets: LibraryAsset[] = [];
  for (let offset = 0; offset <= 100_000; offset += 100) {
    const page = await agentimeHttp.listLibraryAssets({ ...input, limit: 100, offset });
    assets.push(...page);
    if (page.length < 100) return assets;
  }
  return assets;
}

export function folderToLibraryItem(folder: LibraryFolder): LibraryItem {
  return {
    id: folder.id,
    name: folder.name,
    type: 'folder',
    path: normalizeLibraryPath(folder.path),
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    assetsCount: folder.assetsCount,
  };
}

export function assetToLibraryItem(asset: LibraryAsset, folder?: LibraryFolder): LibraryItem {
  return {
    id: asset.id,
    name: asset.fileName,
    type: 'asset',
    path: normalizeLibraryPath(`${folder?.path ?? ''}/${asset.fileName}`),
    mimeType: asset.mimeType,
    fileType: asset.fileType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    tags: asset.tags,
    presentationUrl: asset.presentationUrl ?? undefined,
  };
}

export function buildFolderTree(folders: readonly LibraryFolder[]): FolderTreeNode[] {
  const nodes = new Map(folders.map((folder) => [folder.id, {
    id: folder.id,
    name: folder.name,
    path: folder.path,
    assetsCount: folder.assetsCount,
    children: [] as FolderTreeNode[],
  }]));
  const roots: FolderTreeNode[] = [];
  for (const folder of folders) {
    const node = nodes.get(folder.id)!;
    const parent = folder.parentId ? nodes.get(folder.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (items: FolderTreeNode[]) => {
    items.sort((left, right) => left.name.localeCompare(right.name));
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}
