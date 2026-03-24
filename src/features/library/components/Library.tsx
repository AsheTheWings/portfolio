'use client';

/**
 * Library - Main library component
 * Client component that renders the asset library UI
 *
 * ## Features & Behaviors
 *
 * ### Navigation
 * - Folder hierarchy with breadcrumb navigation
 * - Single-click selects, double-click navigates into folders
 * - Root view shows top-level folders; folder view shows subfolders + assets
 * - Server-side folder hydration for instant navigation (no API calls)
 * - Direct path navigation via URL param (?path=folder/item) - navigates to folder and selects item
 *
 * ### Asset Management
 * - Grid display with responsive columns (2-8 based on viewport)
 * - Upload single/multiple files with real-time progress
 * - Upload folders preserving directory structure
 * - Rename, delete (single/bulk), copy, move, download assets
 * - Video thumbnail extraction on upload
 *
 * ### Folder Management
 * - Create, rename, delete folders
 * - System "home" folder as default upload target
 * - Folder tree creation for preserving upload structure
 *
 * ### Selection
 * - Single-click: select item (second click opens viewer/navigates)
 * - Drag-select: multi-selection with @viselect/react
 * - Keyboard: arrow keys navigate, shift for range (via useKeyboardNavigation)
 * - Ctrl/Cmd+A: select all; Escape: clear selection
 *
 * ### Clipboard Operations
 * - Copy/cut single or multiple items (assets + folders)
 * - Paste with copy (duplicate files) or move (metadata update)
 * - Context menu and keyboard shortcuts (Ctrl/Cmd+C/X/V)
 *  
 * ### Search
 * - Spotlight search (Ctrl/Cmd+K)
 * - Debounced API search for assets
 * - Client-side instant filtering for folders
 * - Search results persist when spotlight closes; Escape clears search
 *
 * ### Asset Viewer
 * - Full-screen viewer for selected asset
 * - Navigate between assets with arrow keys
 *
 * ### Context Menus
 * - Item menu: rename, copy, cut, paste, delete, download (assets only)
 * - Grid menu: refresh, paste, create folder
 *
 * ### Pagination
 * - Client-side pagination (folders + assets combined)
 * - Dynamic items-per-page based on grid columns (7 rows)
 *
 * ### Drag & Drop
 * - Page-level drop zone for file uploads
 * - Auto-opens uploader on drag enter
 *
 * ### Keyboard Shortcuts
 * - Ctrl/Cmd+K: open search
 * - Escape: close search / clear selection
 * - Arrow keys: navigate grid
 * - Enter: open viewer / navigate into folder
 * - Delete/Backspace: delete selected item
 *
 * ### Picker Mode
 * - Lightweight mode for asset selection (mode="picker")
 * - No context menus, uploader, viewer, or pagination
 * - Double-click or selection confirm callback for item selection
 * - Use LibraryPicker wrapper for context view and selection mode
 *
 * ### Override Props
 * - overrideAssets, overrideFolders, overrideBreadcrumbs for custom display
 * - overrideOnNavigate, overrideOnBreadcrumbNavigate for custom navigation
 * - isContextRoot, onRemoveFromContext for context view remove buttons
 * - Used by LibraryPicker to implement context view
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { AssetGrid } from './AssetGrid';
import { AssetUploader } from './AssetUploader';
import { AssetViewer } from './AssetViewer';
import { AssetPagination } from './AssetPagination';
import { LibraryBreadcrumbs } from './LibraryBreadcrumbs';
import { LibraryToolsBar } from './LibraryToolsBar';
import { ItemContextMenu, GridContextMenu } from './LibraryContextMenu';
import { RenameDialog } from './RenameDialog';
import { CreateFolderDialog } from './CreateFolderDialog';
import { SpotlightSearch } from './SpotlightSearch';
import { MangaReader } from './MangaReader';
import { ConfirmationDialog } from '@/features/shared/components/ConfirmationDialog';
import { Toaster } from '@/features/shared/components/shadcn/sonner';
import { SelectionArea } from '@viselect/react';
import { useLibrary } from '../hooks/useLibrary';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useLibrarySearch } from '../hooks/useLibrarySearch';
import { useLibraryDragSelect } from '../hooks/useLibraryDragSelect';
import { useLibraryDropZone } from '../hooks/useLibraryDropZone';
import { useLibraryClipboard } from '../hooks/useLibraryClipboard';
import { useLibraryItemHandlers } from '../hooks/useLibraryItemHandlers';
import { useMangaReader } from '../hooks/useMangaReader';
import { useGridColumns } from '../hooks/useGridColumns';
import type { Folder, Asset } from '../types';
import { X, type LucideIcon } from 'lucide-react';

export type LibraryMode = 'default' | 'picker';

/** Server-side resolved navigation state for instant path navigation */
export interface InitialNavigationState {
  folderId: string | null;
  assets?: Asset[];
  folders?: Folder[];
  breadcrumbs?: Folder[];
  selectedItemName?: string;
}

interface LibraryProps {
  initialFolders?: Folder[];
  /** Server-side resolved navigation state for instant path navigation */
  initialNavigation?: InitialNavigationState;
  /** Mode: 'default' for full library, 'picker' for asset selection */
  mode?: LibraryMode;
  /** Callback when selection is confirmed (picker mode only) */
  onSelectionConfirm?: (assets: Asset[]) => void;
  /** Custom class for container */
  className?: string;
  
  // Override props (used by LibraryPicker for context view)
  /** Override assets to display */
  overrideAssets?: Asset[];
  /** Override folders to display */
  overrideFolders?: Folder[];
  /** Override breadcrumbs to display */
  overrideBreadcrumbs?: Folder[];
  /** Override folder navigation handler */
  overrideOnNavigate?: (folderId: string, folder?: Folder) => void;
  /** Override breadcrumb navigation handler */
  overrideOnBreadcrumbNavigate?: (folderId: string | null, folder?: Folder) => void;
  /** Whether at context root (shows remove buttons) */
  isContextRoot?: boolean;
  /** Callback to remove item from context */
  onRemoveFromContext?: (id: string) => void;
  /** Whether selection mode is active (click toggles selection) */
  isSelectionMode?: boolean;
  /** External loading state */
  isLoading?: boolean;
  /** Custom root label for breadcrumbs */
  rootLabel?: string;
  /** Custom root icon for breadcrumbs */
  RootIcon?: LucideIcon;
  /** Disable drag selection */
  disableDragSelect?: boolean;
}

export function Library({ 
  initialFolders,
  initialNavigation,
  mode = 'default',
  onSelectionConfirm,
  className,
  // Override props
  overrideAssets,
  overrideFolders,
  overrideBreadcrumbs,
  overrideOnNavigate,
  overrideOnBreadcrumbNavigate,
  isContextRoot = false,
  onRemoveFromContext,
  isSelectionMode = false,
  isLoading: externalLoading = false,
  rootLabel = 'Library',
  RootIcon,
  disableDragSelect = false,
}: LibraryProps) {
  const isPickerMode = mode === 'picker';
  
  // Hydrate store with server-fetched folders and navigation state (runs once)
  const hydrateAllFolders = useLibraryStore((state) => state.hydrateAllFolders);
  const [isHydrated, setIsHydrated] = React.useState(false);
  
  useEffect(() => {
    if (initialFolders && !isHydrated) {
      hydrateAllFolders(initialFolders, initialNavigation);
      setIsHydrated(true);
    }
  }, [initialFolders, initialNavigation, hydrateAllFolders, isHydrated]);

  // Main library hook
  const {
    // Navigation
    currentFolderId,
    folders,
    breadcrumbs,
    navigateToFolder,

    // Folder actions
    createFolder,
    createFolderTree,
    renameFolder,
    deleteFolder,

    // Assets
    assets,
    total,
    isLoading,
    error,
    currentPage,
    totalPages,
    itemsPerPage,
    selectedIds,
    isViewerOpen,
    uploadingFiles,
    showUploader,
    hasActiveUploads,

    // Actions
    setPage,
    clearSelection,
    closeViewer,
    navigateViewer,
    setShowUploader,
    uploadAsset,
    uploadAssets,
    removeUploadingFile,
    deleteAsset,
    deleteAssets,
    revalidateAssets,
    renameAsset,
    copyAssets,
    moveAssets,
  } = useLibrary();

  // Store selectors
  const allFolders = useLibraryStore((state) => state.allFolders);
  const toggleSelection = useLibraryStore((state) => state.toggleSelection);

  // Grid columns for keyboard navigation
  const { columns: gridColumns } = useGridColumns();
  
  // Select item by name after hydration (server-side resolved path)
  const itemSelected = useRef(false);
  
  useEffect(() => {
    if (!initialNavigation?.selectedItemName || !isHydrated || itemSelected.current) return;
    
    const itemName = initialNavigation.selectedItemName;
    const folderId = initialNavigation.folderId;
    
    // Check if it's a folder at this level
    const matchingFolder = allFolders.find(
      f => f.parent_id === folderId && f.name === itemName
    );
    
    if (matchingFolder) {
      toggleSelection(matchingFolder.id);
      itemSelected.current = true;
      return;
    }
    
    // Check if it's an asset (assets are pre-loaded from server)
    const matchingAsset = assets.find(a => a.file_name === itemName);
    if (matchingAsset) {
      toggleSelection(matchingAsset.id);
      itemSelected.current = true;
    }
  }, [initialNavigation, isHydrated, assets, allFolders, toggleSelection]);

  // Search hook
  const {
    isSearchOpen,
    searchQuery,
    isSearching,
    displayFolders,
    displayAssets,
    setIsSearchOpen,
    setSearchQuery,
    handleCloseSpotlight,
    handleClearSearch,
  } = useLibrarySearch({ allFolders, folders });

  // Get display assets - use overrides if provided
  const currentDisplayAssets = overrideAssets ?? displayAssets(assets);
  const currentDisplayFolders = overrideFolders ?? displayFolders;
  const currentBreadcrumbs = overrideBreadcrumbs ?? breadcrumbs;

  // Drag select hook
  const { onDragSelectStart, onDragSelectMove } = useLibraryDragSelect();

  // Item handlers hook
  const handlers = useLibraryItemHandlers({
    navigateToFolder,
    displayFolders,
    displayAssets: currentDisplayAssets,
    createFolder,
    createFolderTree,
    renameFolder,
    deleteFolder,
    uploadAsset,
    uploadAssets,
    renameAsset,
    deleteAsset,
    deleteAssets,
    revalidateAssets,
  });

  // Drop zone hook (disabled in picker mode)
  const { isDraggingOver } = useLibraryDropZone({
    onFilesAdded: handlers.handleFilesAdded,
    onDragStart: () => setShowUploader(true),
    disabled: isPickerMode,
  });

  // Clipboard hook
  const { canPaste, handlePaste } = useLibraryClipboard({
    copyAssets,
    moveAssets,
  });

  // Manga reader hook
  const mangaReader = useMangaReader();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }
      
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement;
        if (showUploader || handlers.showCreateFolderDialog || handlers.renameTarget || handlers.deleteTarget) return;
        
        if (isSearchOpen) {
          // Spotlight open → close it (allow even when in input)
          e.preventDefault();
          handleCloseSpotlight();
        } else if (searchQuery.trim()) {
          // Spotlight closed but search active → clear search
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          handleClearSearch();
        } else if (selectedIds.size > 0) {
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          clearSelection();
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSearchOpen, searchQuery, selectedIds.size, showUploader, handlers.showCreateFolderDialog, handlers.renameTarget, handlers.deleteTarget, clearSelection, handleCloseSpotlight, handleClearSearch, setIsSearchOpen]);

  // Keyboard navigation
  useKeyboardNavigation(
    displayFolders,
    currentDisplayAssets,
    {
      columns: gridColumns,
      enabled: !showUploader && !handlers.showCreateFolderDialog && handlers.renameTarget === null && handlers.deleteTarget === null,
      onEnter: handlers.handleKeyboardEnter,
      onDelete: handlers.handleKeyboardDelete,
    }
  );

  // Scroll selected item into view with edge offset
  useEffect(() => {
    if (selectedIds.size !== 1) return;
    const selectedId = Array.from(selectedIds)[0];
    const element = document.querySelector(`[data-item-id="${selectedId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Add offset so card edge isn't flush with screen edge
      const container = element.closest('.scrollbar-container');
      if (container) {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = 16;
        
        if (rect.top - containerRect.top < offset) {
          container.scrollTop -= offset - (rect.top - containerRect.top);
        } else if (rect.bottom - containerRect.bottom > -offset) {
          container.scrollTop += (rect.bottom - containerRect.bottom) + offset;
        }
      }
    }
  }, [selectedIds]);

  // Determine navigation handler
  const handleFolderNavigate = useCallback((folderId: string, folder?: Folder) => {
    handleClearSearch();
    if (overrideOnNavigate) {
      overrideOnNavigate(folderId, folder);
    } else {
      navigateToFolder(folderId, folder);
    }
  }, [handleClearSearch, overrideOnNavigate, navigateToFolder]);

  // Grid content with or without context menu wrapper
  const gridContent = (
    <SelectionArea
      className={`relative flex-1 overflow-y-auto min-h-0 ${isPickerMode ? 'px-4 py-2' : 'px-[4rem] scrollbar-container'}`}
      onStart={disableDragSelect ? undefined : onDragSelectStart}
      onMove={disableDragSelect ? undefined : onDragSelectMove}
      selectables={disableDragSelect ? '' : '[data-item-id]'}
      behaviour={{
        overlap: 'keep',
        scrolling: {
          speedDivider: 1,
          startScrollMargins: { x: 0, y: 100 },
        },
      }}
      features={{
        singleTap: { allow: false },
        touch: true,
      }}
    >
      <AssetGrid
        mode={mode}
        onRetryUpload={handlers.handleRetryUpload}
        onFolderNavigate={handleFolderNavigate}
        overrideAssets={currentDisplayAssets}
        overrideFolders={currentDisplayFolders}
        emptyMessage={isContextRoot && currentDisplayAssets.length === 0 && currentDisplayFolders.length === 0 && !externalLoading ? 'No items in context' : (searchQuery.trim() && !isSearching ? `No results for "${searchQuery}"` : undefined)}
        emptySubtext={isContextRoot && currentDisplayAssets.length === 0 && currentDisplayFolders.length === 0 && !externalLoading ? 'Add items from the library to context' : (searchQuery.trim() && !isSearching ? 'Try a different search term' : undefined)}
        isSearching={(isSearching && !!searchQuery.trim()) || externalLoading}
        isContextRoot={isContextRoot}
        onRemoveFromContext={onRemoveFromContext}
        isSelectionMode={isSelectionMode}
        renderFolderWrapper={isPickerMode 
          ? undefined  // No context menu in picker mode
          : (folder: Folder, children: React.ReactNode) => (
            <ItemContextMenu
              onRename={() => handlers.handleFolderRename(folder)}
              onCopy={() => handlers.handleFolderCopy(folder)}
              onCut={() => handlers.handleFolderCut(folder)}
              onPaste={() => handlePaste(folder.id)}
              onDelete={() => handlers.handleFolderDeleteRequest(folder)}
              onOpenMangaMode={() => mangaReader.openMangaReader(folder)}
              onSelect={() => {}}
              canPaste={canPaste}
              itemPath={folder.path}
              isSystemFolder={folder.is_system}
              isFolder
              isMultiSelection={selectedIds.size > 1 && selectedIds.has(folder.id)}
            >
              {children}
            </ItemContextMenu>
          )
        }
        renderAssetWrapper={isPickerMode
          ? undefined  // No context menu in picker mode
          : (asset: Asset, children: React.ReactNode) => (
            <ItemContextMenu
              onRename={() => handlers.handleAssetRename(asset)}
              onCopy={() => handlers.handleAssetCopy(asset)}
              onCut={() => handlers.handleAssetCut(asset)}
              onPaste={() => handlePaste()}
              onDelete={() => handlers.handleAssetDeleteRequest(asset)}
              onDownload={() => handlers.handleAssetDownload(asset)}
              onSelect={() => {
                const currentSelection = useLibraryStore.getState().selectedIds;
                if (!currentSelection.has(asset.id)) {
                  useLibraryStore.setState({ selectedIds: new Set([asset.id]) });
                }
              }}
              canPaste={canPaste}
              itemPath={asset.storage_path}
              isMultiSelection={selectedIds.size > 1}
            >
              {children}
            </ItemContextMenu>
          )
        }
      />
    </SelectionArea>
  );

  return (
    <div className={className || (isPickerMode ? 'h-full bg-background' : 'h-screen bg-background')}>
      <div className="flex flex-col overflow-hidden h-full">
        {/* Breadcrumbs Header */}
        <div className={`border-b ${isPickerMode ? 'px-4 py-2' : 'px-6 py-3'}`}>
          {searchQuery.trim() ? (
            <div className={`flex items-center justify-between ${isPickerMode ? 'text-xs' : 'text-sm'}`}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Search results for</span>
                <span className="font-medium text-foreground">&quot;{searchQuery}&quot;</span>
                <span className="text-muted-foreground">
                  ({displayFolders.length} folders, {currentDisplayAssets.length} files)
                </span>
              </div>
              <button
                onClick={handleClearSearch}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          ) : (
            <LibraryBreadcrumbs
              breadcrumbs={currentBreadcrumbs}
              onNavigate={overrideOnBreadcrumbNavigate ?? navigateToFolder}
              rootLabel={rootLabel}
              RootIcon={RootIcon}
            />
          )}
        </div>

        {/* Uploader - only in default mode */}
        {!isPickerMode && (
          <AssetUploader
            show={showUploader || isDraggingOver}
            uploadingFiles={uploadingFiles}
            onFilesAdded={handlers.handleFilesAdded}
            onFolderAdded={handlers.handleFolderAdded}
            onClose={() => !hasActiveUploads && setShowUploader(false)}
            onRemoveFile={removeUploadingFile}
            onRetryFile={handlers.handleRetryUpload}
          />
        )}

        {/* Error */}
        {error && (
          <div className={`mt-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm ${isPickerMode ? 'mx-4' : 'mx-6'}`}>
            {error}
          </div>
        )}

        {/* Content Grid - conditionally wrapped in GridContextMenu */}
        {isPickerMode ? (
          gridContent
        ) : (
          <GridContextMenu
            onRefresh={handlers.handleRefresh}
            onPaste={() => handlePaste()}
            onCreateFolder={() => handlers.setShowCreateFolderDialog(true)}
            canPaste={canPaste}
          >
            {gridContent}
          </GridContextMenu>
        )}

        {/* Pagination - only in default mode */}
        {!isPickerMode && totalPages > 1 && (
          <AssetPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            loading={isLoading}
          />
        )}

        {/* Asset Viewer */}
        {isViewerOpen && selectedIds.size === 1 && (() => {
          const selectedId = Array.from(selectedIds)[0];
          const viewerAssets = overrideAssets ?? assets;
          const selectedAsset = viewerAssets.find(a => a.id === selectedId);
          if (!selectedAsset) return null;
          
          const currentAssetIndex = viewerAssets.findIndex(a => a.id === selectedId);
          const hasPrevious = currentAssetIndex > 0;
          const hasNext = currentAssetIndex < viewerAssets.length - 1;
          return (
            <AssetViewer
              focusedId={selectedId}
              assets={viewerAssets}
              onClose={closeViewer}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onPrevious={() => navigateViewer('previous')}
              onNext={() => navigateViewer('next')}
            />
          );
        })()}

        {/* Dialogs - only in default mode */}
        {!isPickerMode && (
          <>
            <RenameDialog
              open={handlers.renameTarget !== null}
              type={handlers.renameTarget?.type || 'asset'}
              currentName={handlers.renameTarget?.name || ''}
              onClose={handlers.closeRenameDialog}
              onRename={handlers.handleRename}
            />

            <CreateFolderDialog
              open={handlers.showCreateFolderDialog}
              onClose={() => handlers.setShowCreateFolderDialog(false)}
              onCreate={handlers.handleCreateFolder}
            />

            <ConfirmationDialog
              open={handlers.deleteTarget !== null}
              onClose={() => handlers.setDeleteTarget(null)}
              onConfirm={handlers.handleConfirmDelete}
              title={
                handlers.deleteTarget?.type === 'multi' 
                  ? `Delete ${handlers.deleteTarget.ids?.length} Items` 
                  : `Delete ${handlers.deleteTarget?.type === 'folder' ? 'Folder' : 'Asset'}`
              }
              contentText={
                handlers.deleteTarget?.type === 'multi'
                  ? `Are you sure you want to delete ${handlers.deleteTarget.ids?.length} selected items? Folders and their contents will be permanently removed.`
                  : `Are you sure you want to delete "${handlers.deleteTarget?.name}"?${handlers.deleteTarget?.type === 'folder' ? ' All contents will be permanently removed.' : ''}`
              }
              warningText="This action cannot be undone"
              confirmButtonText="Delete"
              cancelButtonText="Cancel"
              variant="destructive"
            />

            <Toaster position="bottom-right" richColors closeButton />
          </>
        )}

        {/* Manga Reader */}
        {mangaReader.isOpen && mangaReader.folder && (
          <MangaReader
            folderName={mangaReader.folder.name}
            images={mangaReader.images}
            onClose={mangaReader.closeMangaReader}
          />
        )}
      </div>

      {/* Floating Toolbar - only in default mode */}
      {!isPickerMode && (
        <LibraryToolsBar
          onShowUploader={() => setShowUploader(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      {/* Spotlight Search - only in default mode */}
      {!isPickerMode && (
        <SpotlightSearch
          isOpen={isSearchOpen}
          query={searchQuery}
          isSearching={isSearching}
          onQueryChange={setSearchQuery}
          onClose={handleCloseSpotlight}
        />
      )}
    </div>
  );
}

export default Library;
