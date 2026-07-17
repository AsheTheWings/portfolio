'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { agentimeHttp } from '../../agent/lib/agentime-client';
import {
  assetToLibraryItem,
  buildFolderTree,
  folderToLibraryItem,
  listAllLibraryAssets,
  normalizeLibraryPath,
} from '../lib/agentime-library';
import type { FolderTreeNode, LibraryItem } from '../types';

interface UseLibraryPathBrowserOptions {
  query?: string;
  isOpen?: boolean;
  debounceMs?: number;
}

interface UseLibraryPathBrowserResult {
  items: LibraryItem[];
  folderTree: FolderTreeNode[];
  currentPath: string;
  isLoading: boolean;
  mode: 'tree' | 'search';
  navigateToPath: (path: string, filterText?: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  search: (query: string) => Promise<void>;
  showTree: () => void;
  reset: () => void;
}

export function useLibraryPathBrowser({
  query = '',
  isOpen = true,
  debounceMs = 200,
}: UseLibraryPathBrowserOptions = {}): UseLibraryPathBrowserResult {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'tree' | 'search'>('tree');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFolderTree = useCallback(async () => {
    setIsLoading(true);
    try {
      setFolderTree(buildFolderTree(await agentimeHttp.listLibraryFolders()));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToPath = useCallback(async (path: string, filterText = '') => {
    const normalizedPath = normalizeLibraryPath(path);
    setCurrentPath(normalizedPath);
    setMode('search');
    setIsLoading(true);
    try {
      const folders = await agentimeHttp.listLibraryFolders();
      const target = folders.find((folder) => normalizeLibraryPath(folder.path).toLowerCase() === normalizedPath.toLowerCase());
      const childFolders = folders.filter((folder) => folder.parentId === (target?.id ?? null));
      const assets = target ? await listAllLibraryAssets({ folderId: target.id }) : [];
      const lowerFilter = filterText.trim().toLowerCase();
      const contents = [
        ...childFolders.map(folderToLibraryItem),
        ...assets.map((asset) => assetToLibraryItem(asset, target)),
      ].filter((item) => !lowerFilter || item.name.toLowerCase().includes(lowerFilter));
      contents.sort((left, right) => left.type === right.type
        ? left.name.localeCompare(right.name)
        : left.type === 'folder' ? -1 : 1);
      setItems(contents);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback(async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    setMode('search');
    setIsLoading(true);
    try {
      const folders = await agentimeHttp.listLibraryFolders();
      const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
      const [assets] = await Promise.all([listAllLibraryAssets({ search: searchQuery })]);
      setItems([
        ...folders.filter((folder) => folder.name.toLowerCase().includes(normalizedQuery)).map(folderToLibraryItem),
        ...assets.map((asset) => assetToLibraryItem(asset, foldersById.get(asset.folderId))),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const showTree = useCallback(() => {
    setMode('tree');
    setCurrentPath('');
    setItems([]);
  }, []);

  const navigateUp = useCallback(async () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    if (parts.length === 0) showTree();
    else await navigateToPath(parts.join('/'));
  }, [currentPath, navigateToPath, showTree]);

  const reset = useCallback(() => {
    setItems([]);
    setFolderTree([]);
    setCurrentPath('');
    setMode('tree');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) void loadFolderTree();
  }, [isOpen, loadFolderTree]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const normalizedQuery = query.replace(/^library\//i, '');
    if (normalizedQuery.includes('/')) {
      const pathParts = normalizedQuery.split('/');
      const folderPath = pathParts.slice(0, -1).join('/');
      const filterText = pathParts.at(-1) ?? '';
      debounceRef.current = setTimeout(() => void navigateToPath(folderPath, filterText), debounceMs);
    } else if (normalizedQuery.trim()) {
      debounceRef.current = setTimeout(() => void search(normalizedQuery), debounceMs);
    } else {
      showTree();
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debounceMs, isOpen, navigateToPath, query, search, showTree]);

  return { items, folderTree, currentPath, isLoading, mode, navigateToPath, navigateUp, search, showTree, reset };
}
