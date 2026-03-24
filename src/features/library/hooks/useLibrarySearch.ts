'use client';

/**
 * useLibrarySearch - Search state and logic for library
 * Handles debounced API search for assets and client-side folder filtering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Asset, Folder } from '../types';

interface UseLibrarySearchOptions {
  allFolders: Folder[];
  folders: Folder[];
  debounceMs?: number;
}

interface UseLibrarySearchResult {
  isSearchOpen: boolean;
  searchQuery: string;
  searchResults: Asset[];
  isSearching: boolean;
  displayFolders: Folder[];
  displayAssets: (assets: Asset[]) => Asset[];
  setIsSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  /** Close spotlight overlay (doesn't clear search) */
  handleCloseSpotlight: () => void;
  /** Clear search query and results */
  handleClearSearch: () => void;
}

export function useLibrarySearch({
  allFolders,
  folders,
  debounceMs = 500,
}: UseLibrarySearchOptions): UseLibrarySearchResult {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search API call
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/library/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.assets || []);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, debounceMs]);

  // Filter folders based on search query (client-side, instant)
  const searchFilteredFolders = searchQuery.trim()
    ? allFolders.filter(f => !f.is_system && f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;

  // Display folders: filtered if search query exists (regardless of spotlight state)
  const displayFolders = searchQuery.trim() ? searchFilteredFolders : folders;

  // Display assets function: returns search results if query exists (regardless of spotlight state)
  const displayAssets = useCallback((assets: Asset[]) => {
    return searchQuery.trim() ? searchResults : assets;
  }, [searchQuery, searchResults]);

  // Close spotlight (doesn't clear search)
  const handleCloseSpotlight = useCallback(() => {
    setIsSearchOpen(false);
  }, []);
  
  // Clear search completely
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    isSearchOpen,
    searchQuery,
    searchResults,
    isSearching,
    displayFolders,
    displayAssets,
    setIsSearchOpen,
    setSearchQuery,
    handleCloseSpotlight,
    handleClearSearch,
  };
}
