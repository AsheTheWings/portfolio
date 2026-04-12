/**
 * Library feature types
 */

// Asset file type categories
export type AssetFileType = 'image' | 'video' | 'document' | 'other';

// =============================================
// Folder types
// =============================================

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  path: string;
  depth: number;
  isSystem: boolean;
  isLocked: boolean;
  assetsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderWithContents extends Folder {
  subfolders: Folder[];
  assets: Asset[];
}

export interface CreateFolderRequest {
  name: string;
  parentId: string | null;
}

export interface UpdateFolderRequest {
  name?: string;
  parentId?: string | null;  // Move folder
}

export interface ListFolderParams {
  parentId?: string | null;  // null = top-level folders
}

// =============================================

// Asset metadata stored in database
export interface Asset {
  id: string;
  userId: string;
  folderId: string;
  fileName: string;
  storagePath: string;
  url: string;
  fileType: AssetFileType;
  mimeType: string | null;
  sizeKb: number | null;
  altText: string | null;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Joined data
  tags?: Tag[];
  folder?: Folder;
}

// Tag definition
export interface Tag {
  id: string;
  userId: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

// Join response types
export interface AssetItemTagJoin {
  assetTags: Tag;
}

export interface AssetWithTagsJoin {
  assetItemTags?: AssetItemTagJoin[];
}

// Upload request
export interface UploadAssetRequest {
  file: File;
  folderId: string;
  altText?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Folder upload request
export interface UploadFolderRequest {
  files: FileWithPath[];
  parentId: string | null;  // null = create as top-level folder
}

// File with relative path (from folder upload)
export interface FileWithPath {
  file: File;
  relativePath: string;  // e.g., "photos/2024/image.jpg"
}

// Upload response
export interface UploadAssetResponse {
  asset: Asset;
  tags: Tag[];
}

// List assets query params (no pagination - client-side pagination used)
export interface ListAssetsParams {
  folderId?: string;  // Filter by folder
  fileType?: AssetFileType;
  tag?: string;
  search?: string;
  sortBy?: 'createdAt' | 'fileName' | 'sizeKb';
  sortOrder?: 'asc' | 'desc';
}

// Update asset request
export interface UpdateAssetRequest {
  fileName?: string;  // Rename
  altText?: string;
  folderId?: string;  // Move to different folder
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Signed URL response
export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
}

// Storage upload result
export interface StorageUploadResult {
  path: string;
  id: string;
  fullPath: string;
}

// Derive file type from MIME type
export function getFileTypeFromMime(mimeType: string): AssetFileType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
}

// Allowed MIME types (must match storage bucket config)
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// Max file size (50MB)
export const MAX_FILE_SIZE_BYTES = 52428800;
export const MAX_FILE_SIZE_KB = 51200;

/**
 * Normalize a file or folder name for consistent path handling.
 * - Replaces whitespace with underscores
 * - Removes characters that are invalid in paths
 * - Trims leading/trailing whitespace
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')              // whitespace → underscore
    .replace(/[<>:"/\\|?*]/g, '_');    // invalid path chars → underscore
}

// =============================================
// Browse API types
// =============================================

/**
 * API response format for browse endpoint
 */
export interface ApiLightAssetItem {
  id: string;
  name: string;
  path: string;
  type: 'asset' | 'folder';
  thumbnailUrl?: string;
  fileType?: 'image' | 'video' | 'document';
  storageUrl?: string;
  mimeType?: string;
}

/**
 * Lightweight item representation for browse/search results
 */
export interface LibraryItem {
  id: string;
  name: string;
  type: 'folder' | 'asset';
  path: string;
  mimeType?: string;
  fileType?: string;
  sizeKb?: number;
  createdAt: string;
  updatedAt: string;
  assetsCount?: number;
  tags?: string[];
  thumbnailUrl?: string;
  /** Full URL to the actual asset (for viewer) */
  storageUrl?: string;
}

/**
 * Folder tree node for hierarchical navigation
 */
export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  assetsCount: number;
  children: FolderTreeNode[];
}
