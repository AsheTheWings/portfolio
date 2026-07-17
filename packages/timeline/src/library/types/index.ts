import type { LibraryAsset, LibraryFolder } from '@agentime/protocol';

export type AssetFileType = 'image' | 'video' | 'document' | 'other';
export type Folder = LibraryFolder;
export type Asset = LibraryAsset;

/** Presentation-only aggregate used by the local filter UI. */
export interface Tag {
  id: string;
  tag: string;
}

export interface FolderWithContents extends Folder {
  subfolders: Folder[];
  assets: Asset[];
}

export interface CreateFolderRequest { name: string; parentId: string | null }
export interface UpdateFolderRequest { name?: string; parentId?: string | null }
export interface ListFolderParams { parentId?: string | null }

export interface UploadAssetRequest {
  file: File;
  folderId: string;
  altText?: string;
  tags?: string[];
}

export interface UploadFolderRequest { files: FileWithPath[]; parentId: string | null }
export interface FileWithPath { file: File; relativePath: string }
export interface UploadAssetResponse { asset: Asset }

export interface ListAssetsParams {
  folderId?: string;
  fileType?: AssetFileType;
  tag?: string;
  search?: string;
  sortBy?: 'createdAt' | 'fileName' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateAssetRequest {
  fileName?: string;
  altText?: string;
  folderId?: string;
  tags?: string[];
}

export function getFileTypeFromMime(mimeType: string): AssetFileType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
}

export const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'application/pdf',
] as const;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];
export const MAX_FILE_SIZE_BYTES = 52_428_800;
export const MAX_FILE_SIZE_KB = 51_200;

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '_');
}

export interface LibraryItem {
  id: string;
  name: string;
  type: 'folder' | 'asset';
  path: string;
  mimeType?: string;
  fileType?: string;
  sizeBytes?: number;
  createdAt: string;
  updatedAt: string;
  assetsCount?: number;
  tags?: string[];
  presentationUrl?: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  assetsCount: number;
  children: FolderTreeNode[];
}
