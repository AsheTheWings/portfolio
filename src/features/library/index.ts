/**
 * Library feature exports
 */

// Types
export type {
  Asset,
  Tag,
  AssetFileType,
  ListAssetsParams,
  UploadAssetRequest,
  UpdateAssetRequest,
  SignedUrlResponse,
  // Folder types
  Folder,
  FolderWithContents,
  CreateFolderRequest,
  UpdateFolderRequest,
  ListFolderParams,
  FileWithPath,
  UploadFolderRequest,
  // Browse API types
  LibraryItem,
  FolderTreeNode,
} from './types';

export {
  getFileTypeFromMime,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_KB,
} from './types';

export type { AllowedMimeType } from './types';

// Components
export {
  Library,
  type LibraryMode,
  LibraryPicker,
  type LibraryPickerProps,
  LibraryBreadcrumbs,
  FolderCard,
  AssetCard,
  AssetDropZone,
  AssetGrid,
  AssetPagination,
  AssetSkeleton,
  AssetUploader,
  AssetViewer,
  UploadingAssetItem,
  type UploadingFile,
} from './components';

// Lightweight grid for embedding (messages, previews)
export { LightAssetGrid, type LightAssetItem } from './components/LightAssetGrid';

// Path browser for library navigation (used by agent mentions and library features)
export { LibraryPathBrowser } from './components/LibraryPathBrowser';

// Stores
export { useLibraryStore, type LibraryState } from './stores';

// Hooks
export { useLibrary } from './hooks/useLibrary';
export { useAssetUpload } from './hooks/useAssetUpload';
export { useAssetMutations } from './hooks/useAssetMutations';
export { useAssets } from './hooks/useAssets';
export { useFolderActions } from './hooks/useFolders';
export { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
export { useLibrarySearch } from './hooks/useLibrarySearch';
export { useLibraryDragSelect } from './hooks/useLibraryDragSelect';
export { useLibraryDropZone } from './hooks/useLibraryDropZone';
export { useLibraryClipboard } from './hooks/useLibraryClipboard';
export { useLibraryItemHandlers } from './hooks/useLibraryItemHandlers';
export { useGridColumns } from './hooks/useGridColumns';
export { useAssetsByIds } from './hooks/useAssetsByIds';
export { useLibraryItemsByPaths } from './hooks/useLibraryItemsByPaths';
export { useLibraryPathBrowser } from './hooks/useLibraryPathBrowser';

// Utils
export { extractVideoThumbnail, createThumbnailFile } from './utils';

// NOTE: Server-side services (AssetService, FolderService, TagService, StorageService)
// must be imported directly from their files to avoid bundling server code into client:
// import { AssetService } from '@/features/library/services/asset.service';
