'use client';

/**
 * Library Store - Zustand state management for asset library
 */

import { create } from 'zustand';
import type { Asset, Tag, Folder, ListAssetsParams } from '../types';
import type { UploadingFile } from '../components/UploadingAssetItem';

export interface LibraryState {
  // Navigation
  currentFolderId: string | null;  // null = root view
  allFolders: Folder[];  // Complete folder tree (server-hydrated)
  folders: Folder[];     // Folders at current level (derived from allFolders)
  breadcrumbs: Folder[];
  homeFolder: Folder | null;
  isLoadingFolders: boolean;

  // Assets
  assets: Asset[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Tags
  tags: Tag[];
  isLoadingTags: boolean;

  // Filters & pagination
  filters: ListAssetsParams;
  currentPage: number;
  itemsPerPage: number;

  // Selection
  selectedIds: Set<string>;
  focusedId: string | null;
  selectionMode: boolean;

  // Viewer
  isViewerOpen: boolean;

  // Upload
  uploadingFiles: UploadingFile[];
  isUploading: boolean;
  showUploader: boolean;

  // Clipboard (supports multiple items)
  clipboard: {
    type: 'asset' | 'folder' | 'mixed' | null;
    ids: string[];
    operation: 'copy' | 'move' | null;
  };

  // Context menu / dialogs
  renameTarget: { type: 'asset' | 'folder'; id: string; name: string } | null;

  // Actions - Navigation
  hydrateAllFolders: (folders: Folder[], initialNavigation?: {
    folderId: string | null;
    assets?: Asset[];
    folders?: Folder[];
    breadcrumbs?: Folder[];
    selectedItemName?: string;
  }) => void;
  setCurrentFolderId: (folderId: string | null) => void;
  setFolders: (folders: Folder[]) => void;
  setBreadcrumbs: (breadcrumbs: Folder[]) => void;
  setHomeFolder: (folder: Folder) => void;
  setLoadingFolders: (isLoading: boolean) => void;
  navigateToFolder: (folderId: string | null, folder?: Folder) => void;
  navigateUp: () => void;
  getFoldersAtLevel: (parentId: string | null) => Folder[];
  buildBreadcrumbs: (folderId: string | null) => Folder[];

  // Actions - Data fetching
  setAssets: (assets: Asset[], total: number) => void;
  setTags: (tags: Tag[]) => void;
  setLoading: (isLoading: boolean) => void;
  setLoadingTags: (isLoadingTags: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Filters & pagination
  setFilters: (filters: Partial<ListAssetsParams>) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;

  // Actions - Selection
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFocusedId: (id: string | null) => void;
  setSelectionMode: (mode: boolean) => void;

  // Actions - Viewer
  openViewer: () => void;
  closeViewer: () => void;
  navigateViewer: (direction: 'next' | 'previous') => void;

  // Actions - Upload
  setShowUploader: (show: boolean) => void;
  addUploadingFile: (file: UploadingFile) => void;
  updateUploadingFile: (id: string, updates: Partial<UploadingFile>) => void;
  removeUploadingFile: (id: string) => void;
  clearCompletedUploads: () => void;

  // Actions - CRUD updates
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  addFolder: (folder: Folder) => void;
  addFolders: (folders: Folder[]) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  removeFolder: (id: string) => void;

  // Actions - Clipboard
  copyToClipboard: (type: 'asset' | 'folder' | 'mixed', ids: string | string[], operation?: 'copy' | 'move') => void;
  clearClipboard: () => void;

  // Actions - Rename dialog
  openRenameDialog: (type: 'asset' | 'folder', id: string, name: string) => void;
  closeRenameDialog: () => void;

  // Reset
  reset: () => void;
}

const defaultFilters: ListAssetsParams = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const initialState = {
  // Navigation
  currentFolderId: null as string | null,
  allFolders: [] as Folder[],
  folders: [] as Folder[],
  breadcrumbs: [] as Folder[],
  homeFolder: null as Folder | null,
  isLoadingFolders: true, // Start true until hydrated from server

  // Assets
  assets: [] as Asset[],
  total: 0,
  isLoading: false,
  error: null as string | null,

  // Tags
  tags: [] as Tag[],
  isLoadingTags: false,

  // Filters & pagination
  filters: defaultFilters,
  currentPage: 1,
  itemsPerPage: 56,

  // Selection
  selectedIds: new Set<string>(),
  focusedId: null as string | null,
  selectionMode: false,

  // Viewer
  isViewerOpen: false,

  // Upload
  uploadingFiles: [] as UploadingFile[],
  isUploading: false,
  showUploader: false,

  // Clipboard (supports single or multiple items)
  clipboard: {
    type: null as 'asset' | 'folder' | 'mixed' | null,
    ids: [] as string[],
    operation: null as 'copy' | 'move' | null,
  },

  // Context menu / dialogs
  renameTarget: null as { type: 'asset' | 'folder'; id: string; name: string } | null,
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initialState,

  // Navigation actions
  hydrateAllFolders: (folders, initialNavigation) => {
    const homeFolder = folders.find(f => f.isSystem && f.name === 'home' && f.parentId === null) || null;
    
    // If initial navigation provided, use it directly (server-side resolved path)
    if (initialNavigation) {
      const foldersAtLevel = initialNavigation.folders ?? (
        initialNavigation.folderId === null
          ? folders.filter(f => f.parentId === null)
          : folders.filter(f => f.parentId === initialNavigation.folderId)
      );
      
      // Calculate page containing selected item (if any)
      let targetPage = 1;
      if (initialNavigation.selectedItemName) {
        const { itemsPerPage } = get();
        
        // Sort folders and assets same way as AssetGrid
        const sortedFolders = [...foldersAtLevel].sort((a, b) => {
          if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        const sortedAssets = [...(initialNavigation.assets ?? [])].sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        
        // Find item index in combined list
        const folderIndex = sortedFolders.findIndex(f => f.name === initialNavigation.selectedItemName);
        const assetIndex = sortedAssets.findIndex(a => a.fileName === initialNavigation.selectedItemName);
        
        let itemIndex = -1;
        if (folderIndex !== -1) {
          itemIndex = folderIndex;
        } else if (assetIndex !== -1) {
          itemIndex = sortedFolders.length + assetIndex;
        }
        
        if (itemIndex !== -1) {
          targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
        }
      }
      
      set({
        allFolders: folders,
        currentFolderId: initialNavigation.folderId,
        folders: foldersAtLevel,
        breadcrumbs: initialNavigation.breadcrumbs ?? [],
        assets: initialNavigation.assets ?? [],
        total: initialNavigation.assets?.length ?? 0,
        currentPage: targetPage,
        homeFolder,
        isLoadingFolders: false,
        isLoading: false,
        filters: { ...get().filters, folderId: initialNavigation.folderId ?? undefined },
      });
      return;
    }
    
    // No initialNavigation - preserve current navigation if already set
    const { currentFolderId } = get();
    const foldersAtLevel = currentFolderId === null
      ? folders.filter(f => f.parentId === null)
      : folders.filter(f => f.parentId === currentFolderId);
    
    set({ 
      allFolders: folders, 
      folders: foldersAtLevel,
      homeFolder,
      isLoadingFolders: false,
    });
  },

  setCurrentFolderId: (currentFolderId) => set({ currentFolderId }),
  
  setFolders: (folders) => set({ folders, isLoadingFolders: false }),
  
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
  
  setHomeFolder: (homeFolder) => set({ homeFolder }),
  
  setLoadingFolders: (isLoadingFolders) => set({ isLoadingFolders }),

  getFoldersAtLevel: (parentId) => {
    const { allFolders } = get();
    if (parentId === null) {
      return allFolders.filter(f => f.parentId === null);
    }
    return allFolders.filter(f => f.parentId === parentId);
  },

  buildBreadcrumbs: (folderId) => {
    if (folderId === null) return [];
    const { allFolders } = get();
    const breadcrumbs: Folder[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (!folder) break;
      breadcrumbs.unshift(folder);
      currentId = folder.parentId;
    }
    
    return breadcrumbs;
  },
  
  navigateToFolder: (folderId) => {
    const { allFolders } = get();
    
    // Build breadcrumbs from allFolders (instant, no API call)
    const newBreadcrumbs = get().buildBreadcrumbs(folderId);
    
    // Get folders at this level from allFolders
    const foldersAtLevel = folderId === null
      ? allFolders.filter(f => f.parentId === null)
      : allFolders.filter(f => f.parentId === folderId);
    
    set({ 
      currentFolderId: folderId,
      breadcrumbs: newBreadcrumbs,
      folders: foldersAtLevel,
      assets: [], // Clear assets (will be fetched by SWR)
      currentPage: 1,
      filters: { ...get().filters, folderId: folderId || undefined },
      selectedIds: new Set(),
      focusedId: null,
      selectionMode: false,
    });
  },
  
  navigateUp: () => {
    const { breadcrumbs } = get();
    if (breadcrumbs.length > 1) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      get().navigateToFolder(parent.id);
    } else {
      get().navigateToFolder(null);
    }
  },

  // Data fetching actions
  setAssets: (assets, total) => set({ assets, total, isLoading: false }),
  
  setTags: (tags) => set({ tags, isLoadingTags: false }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setLoadingTags: (isLoadingTags) => set({ isLoadingTags }),
  
  setError: (error) => set({ error, isLoading: false }),

  // Filter & pagination actions
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1, // Reset to first page on filter change
    }));
  },

  setPage: (page) => set({ currentPage: page }),

  resetFilters: () => set({ filters: defaultFilters, currentPage: 1 }),

  // Selection actions
  toggleSelection: (id) => {
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { 
        selectedIds: newSelectedIds,
        focusedId: id,
        selectionMode: newSelectedIds.size > 0,
      };
    });
  },

  selectAll: () => {
    const { assets } = get();
    set({
      selectedIds: new Set(assets.map(a => a.id)),
      selectionMode: true,
    });
  },

  clearSelection: () => set({ 
    selectedIds: new Set(), 
    selectionMode: false,
    isViewerOpen: false,
  }),

  setFocusedId: (focusedId) => set({ focusedId }),

  setSelectionMode: (selectionMode) => {
    if (!selectionMode) {
      set({ selectionMode, selectedIds: new Set() });
    } else {
      set({ selectionMode });
    }
  },

  // Viewer actions
  openViewer: () => set({ isViewerOpen: true }),
  
  closeViewer: () => set({ isViewerOpen: false }),

  navigateViewer: (direction) => {
    const { assets, selectedIds } = get();
    if (selectedIds.size === 0 || assets.length === 0) return;

    const selectedId = Array.from(selectedIds)[0];
    const currentIndex = assets.findIndex(a => a.id === selectedId);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex < assets.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    }

    set({ selectedIds: new Set([assets[newIndex].id]) });
  },

  // Upload actions
  setShowUploader: (showUploader) => set({ showUploader }),

  addUploadingFile: (file) => {
    set((state) => ({
      uploadingFiles: [...state.uploadingFiles, file],
      isUploading: true,
      showUploader: true,
    }));
  },

  updateUploadingFile: (id, updates) => {
    set((state) => ({
      uploadingFiles: state.uploadingFiles.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
      isUploading: state.uploadingFiles.some(
        f => f.id !== id ? f.status === 'uploading' : updates.status === 'uploading'
      ),
    }));
  },

  removeUploadingFile: (id) => {
    set((state) => {
      // Revoke preview URL to prevent memory leak
      const file = state.uploadingFiles.find(f => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      
      const remaining = state.uploadingFiles.filter(f => f.id !== id);
      return {
        uploadingFiles: remaining,
        isUploading: remaining.some(f => f.status === 'uploading'),
        showUploader: remaining.length > 0 ? state.showUploader : false,
      };
    });
  },

  clearCompletedUploads: () => {
    set((state) => {
      const remaining = state.uploadingFiles.filter(f => f.status !== 'completed');
      return {
        uploadingFiles: remaining,
        isUploading: remaining.some(f => f.status === 'uploading'),
      };
    });
  },

  // CRUD update actions
  addAsset: (asset) => {
    set((state) => ({
      assets: [asset, ...state.assets],
      total: state.total + 1,
    }));
  },

  updateAsset: (id, updates) => {
    set((state) => ({
      assets: state.assets.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },

  removeAsset: (id) => {
    set((state) => ({
      assets: state.assets.filter(a => a.id !== id),
      total: state.total - 1,
      selectedIds: (() => {
        const newSet = new Set(state.selectedIds);
        newSet.delete(id);
        return newSet;
      })(),
    }));
  },

  addFolder: (folder) => {
    set((state) => {
      const sortFolders = (folders: Folder[]) => 
        [...folders].sort((a, b) => {
          if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      
      return {
        allFolders: sortFolders([...state.allFolders, folder]),
        folders: sortFolders([...state.folders, folder]),
      };
    });
  },

  addFolders: (newFolders) => {
    set((state) => {
      const sortFolders = (folders: Folder[]) => 
        [...folders].sort((a, b) => {
          if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      
      // Filter out duplicates by id
      const existingIds = new Set(state.allFolders.map(f => f.id));
      const uniqueNewFolders = newFolders.filter(f => !existingIds.has(f.id));
      
      // Only add folders at the current level to the visible folders array
      const foldersAtCurrentLevel = uniqueNewFolders.filter(
        f => f.parentId === state.currentFolderId
      );
      
      return {
        allFolders: sortFolders([...state.allFolders, ...uniqueNewFolders]),
        folders: sortFolders([...state.folders, ...foldersAtCurrentLevel]),
      };
    });
  },

  updateFolder: (id, updates) => {
    set((state) => ({
      allFolders: state.allFolders.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
      folders: state.folders.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
      breadcrumbs: state.breadcrumbs.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  removeFolder: (id) => {
    set((state) => ({
      allFolders: state.allFolders.filter(f => f.id !== id),
      folders: state.folders.filter(f => f.id !== id),
    }));
  },

  // Clipboard actions
  copyToClipboard: (type, ids, operation = 'copy') => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    set({
      clipboard: { type, ids: idArray, operation },
    });
  },

  clearClipboard: () => {
    set({
      clipboard: { type: null, ids: [], operation: null },
    });
  },

  // Rename dialog actions
  openRenameDialog: (type, id, name) => {
    set({ renameTarget: { type, id, name } });
  },

  closeRenameDialog: () => {
    set({ renameTarget: null });
  },

  // Reset
  reset: () => set(initialState),
}));
