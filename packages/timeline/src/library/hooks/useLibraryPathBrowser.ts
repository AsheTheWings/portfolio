'use client';

/**
 * useLibraryPathBrowser - Business logic for browsing library by path
 * 
 * Handles:
 * - Folder tree loading
 * - Path navigation (Photos/sunset)
 * - Search within folders
 * - Global library search
 * - Item filtering and sorting
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LibraryItem, FolderTreeNode } from '../types';

type BrowseResult = {
  status: 'success' | 'error';
  message?: string;
  items?: Record<string, LibraryItem>;
  tree?: FolderTreeNode[];
};

interface UseLibraryPathBrowserOptions {
  /** Initial query (e.g., "Photos/sunset") */
  query?: string;
  /** Whether browser is open */
  isOpen?: boolean;
  /** Debounce delay for search (ms) */
  debounceMs?: number;
}

interface UseLibraryPathBrowserResult {
  // Data
  items: LibraryItem[];
  folderTree: FolderTreeNode[];
  currentPath: string;
  isLoading: boolean;
  mode: 'tree' | 'search';
  
  // Actions
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
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'tree' | 'search'>('tree');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Function definitions (before effects that reference them) ──

  const loadFolderTree = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/library/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder_tree' }),
      });
      const data: BrowseResult = await res.json();
      if (data.status === 'success' && data.tree) {
        setFolderTree(data.tree);
      }
    } catch (err) {
      console.error('Failed to load folder tree:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToPath = useCallback(async (path: string, filterText: string = '') => {
    setIsLoading(true);
    setCurrentPath(path);
    try {
      const res = await fetch('/api/library/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_items', path: path || undefined }),
      });
      const data: BrowseResult = await res.json();
      if (data.status === 'success' && data.items) {
        let itemList = Object.values(data.items);
        // Filter by text if provided
        if (filterText) {
          const lower = filterText.toLowerCase();
          itemList = itemList.filter(item => 
            item.name.toLowerCase().includes(lower)
          );
        }
        // Sort: folders first, then by name
        itemList.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setItems(itemList);
        setMode('search');
      }
    } catch (err) {
      console.error('Failed to load folder contents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Find folders matching a query from the folder tree
   */
  const findMatchingFolders = useCallback((tree: FolderTreeNode[], query: string): LibraryItem[] => {
    const results: LibraryItem[] = [];
    const lower = query.toLowerCase();
    
    const traverse = (nodes: FolderTreeNode[]) => {
      for (const node of nodes) {
        const nodePath = node.path.replace(/^\/+/, '').replace(/\/+$/, '');
        if (node.name.toLowerCase().includes(lower)) {
          results.push({
            id: node.id,
            name: node.name,
            type: 'folder',
            path: nodePath,
            createdAt: '',
            updatedAt: '',
            assetsCount: node.assetsCount,
          });
        }
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(tree);
    return results;
  }, []);

  const search = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      // Search for matching folders from tree
      const matchingFolders = findMatchingFolders(folderTree, searchQuery);
      
      // Search for matching assets via API
      const res = await fetch('/api/library/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: searchQuery }),
      });
      const data: BrowseResult = await res.json();
      
      // Combine folders + assets (folders first)
      const assets = data.status === 'success' && data.items ? Object.values(data.items) : [];
      setItems([...matchingFolders, ...assets]);
    } catch (err) {
      console.error('Failed to search library:', err);
      // Still show matching folders even if API fails
      setItems(findMatchingFolders(folderTree, searchQuery));
    } finally {
      setIsLoading(false);
    }
  }, [folderTree, findMatchingFolders]);

  const showTree = useCallback(() => {
    setMode('tree');
    setCurrentPath('');
    setItems([]);
  }, []);

  const navigateUp = useCallback(async () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const newPath = parts.join('/');
      await navigateToPath(newPath);
    } else {
      showTree();
    }
  }, [currentPath, navigateToPath, showTree]);

  const reset = useCallback(() => {
    setItems([]);
    setFolderTree([]);
    setCurrentPath('');
    setMode('tree');
    setIsLoading(false);
  }, []);

  // ── Effects (after all function definitions) ──

  // Load folder tree on mount or when opened
  useEffect(() => {
    if (!isOpen) return;
    loadFolderTree();
  }, [isOpen, loadFolderTree]);

  // Handle query changes
  useEffect(() => {
    if (!isOpen) return;

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Normalize query: strip "library/" prefix if user types full format
    const normalizedQuery = query.replace(/^library\//i, '');

    // If query contains "/" - navigate to path
    if (normalizedQuery.includes('/')) {
      const pathParts = normalizedQuery.split('/');
      const folderPath = pathParts.slice(0, -1).join('/');
      const searchPart = pathParts[pathParts.length - 1];
      
      debounceRef.current = setTimeout(() => {
        navigateToPath(folderPath, searchPart);
      }, debounceMs);
    } 
    // If query has text but no "/" - search mode
    else if (normalizedQuery.trim()) {
      setMode('search');
      debounceRef.current = setTimeout(() => {
        search(normalizedQuery);
      }, debounceMs);
    }
    // Empty query - show tree
    else {
      setMode('tree');
      setCurrentPath('');
      loadFolderTree();
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, isOpen, debounceMs, navigateToPath, search, loadFolderTree]);

  return {
    items,
    folderTree,
    currentPath,
    isLoading,
    mode,
    navigateToPath,
    navigateUp,
    search,
    showTree,
    reset,
  };
}
