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
  parent_id: string | null;
  user_id: string;
  path: string;
  depth: number;
  is_system: boolean;
  assets_count: number;
  created_at: string;
  updated_at: string;
}

export interface FolderWithContents extends Folder {
  subfolders: Folder[];
  assets: Asset[];
}

export interface CreateFolderRequest {
  name: string;
  parent_id: string | null;
}

export interface UpdateFolderRequest {
  name?: string;
  parent_id?: string | null;  // Move folder
}

export interface ListFolderParams {
  parent_id?: string | null;  // null = top-level folders
}

// =============================================

// Asset metadata stored in database
export interface Asset {
  id: string;
  user_id: string;
  folder_id: string;
  file_name: string;
  storage_path: string;
  url: string;
  file_type: AssetFileType;
  mime_type: string | null;
  size_kb: number | null;
  alt_text: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined data
  tags?: Tag[];
  folder?: Folder;
}

// Tag definition
export interface Tag {
  id: string;
  user_id: string;
  tag: string;
  created_at: string;
  updated_at: string;
}

// Supabase join response types
export interface AssetItemTagJoin {
  asset_tags: Tag;
}

export interface AssetWithTagsJoin {
  asset_item_tags?: AssetItemTagJoin[];
}

// Upload request
export interface UploadAssetRequest {
  file: File;
  folder_id: string;
  alt_text?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// Folder upload request
export interface UploadFolderRequest {
  files: FileWithPath[];
  parent_id: string | null;  // null = create as top-level folder
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
  folder_id?: string;  // Filter by folder
  file_type?: AssetFileType;
  tag?: string;
  search?: string;
  sort_by?: 'created_at' | 'file_name' | 'size_kb';
  sort_order?: 'asc' | 'desc';
}

// Update asset request
export interface UpdateAssetRequest {
  file_name?: string;  // Rename
  alt_text?: string;
  folder_id?: string;  // Move to different folder
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
 * API response format for browse endpoint (snake_case)
 */
export interface ApiLightAssetItem {
  id: string;
  name: string;
  path: string;
  type: 'asset' | 'folder';
  thumbnail_url?: string;
  file_type?: 'image' | 'video' | 'document';
  storage_url?: string;
  mime_type?: string;
}

/**
 * Lightweight item representation for browse/search results
 */
export interface LibraryItem {
  id: string;
  name: string;
  type: 'folder' | 'asset';
  path: string;
  mime_type?: string;
  file_type?: string;
  size_kb?: number;
  created_at: string;
  updated_at: string;
  assets_count?: number;
  tags?: string[];
  thumbnail_url?: string;
  /** Full URL to the actual asset (for viewer) */
  storage_url?: string;
}

/**
 * Folder tree node for hierarchical navigation
 */
export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  assets_count: number;
  children: FolderTreeNode[];
}
