'use client';

/**
 * useKeyboardNavigation - Arrow key navigation for library grid
 * Uses selectedIds as single selection state
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import type { Folder, Asset } from '../types';

interface NavigationItem {
  id: string;
  type: 'folder' | 'asset';
}

interface UseKeyboardNavigationOptions {
  /** Number of columns in the grid */
  columns?: number;
  /** Enable/disable navigation */
  enabled?: boolean;
  /** Callback when Enter is pressed on selected item */
  onEnter?: (item: NavigationItem) => void;
  /** Callback when Delete is pressed */
  onDelete?: (item: NavigationItem) => void;
}

/**
 * Hook for keyboard navigation in the library grid
 */
export function useKeyboardNavigation(
  folders: Folder[],
  assets: Asset[],
  options: UseKeyboardNavigationOptions = {}
) {
  const {
    columns = 6,
    enabled = true,
    onEnter,
    onDelete,
  } = options;

  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const clearSelection = useLibraryStore((state) => state.clearSelection);
  const isViewerOpen = useLibraryStore((state) => state.isViewerOpen);

  // Combine folders and assets into a single navigation list
  const items: NavigationItem[] = useMemo(() => [
    ...folders.map(f => ({ id: f.id, type: 'folder' as const })),
    ...assets.map(a => ({ id: a.id, type: 'asset' as const })),
  ], [folders, assets]);

  // Get current selected index (first selected item)
  const getCurrentIndex = useCallback(() => {
    if (selectedIds.size === 0) return -1;
    const selectedId = Array.from(selectedIds)[0];
    return items.findIndex(item => item.id === selectedId);
  }, [items, selectedIds]);

  // Set selection to item at index (single selection)
  const setSelectionAtIndex = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;
    
    const item = items[index];
    // Use store's internal method to set single selection
    useLibraryStore.setState({ selectedIds: new Set([item.id]) });
  }, [items]);

  // Calculate new index based on direction
  const getNewIndex = useCallback((currentIndex: number, direction: 'up' | 'down' | 'left' | 'right') => {
    const total = items.length;
    if (total === 0) return -1;

    // If nothing focused, start at first item
    if (currentIndex === -1) {
      return 0;
    }

    let newIndex = currentIndex;

    switch (direction) {
      case 'left':
        newIndex = currentIndex - 1;
        break;
      case 'right':
        newIndex = currentIndex + 1;
        break;
      case 'up':
        newIndex = currentIndex - columns;
        break;
      case 'down':
        newIndex = currentIndex + columns;
        break;
    }

    // Clamp to valid range
    if (newIndex < 0) return 0;
    if (newIndex >= total) return total - 1;

    return newIndex;
  }, [items.length, columns]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if navigation disabled
    if (!enabled) return;

    // Skip if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const currentIndex = getCurrentIndex();
    let handled = false;

    // When viewer is open, use linear navigation (left/right only)
    if (isViewerOpen) {
      switch (e.key) {
        case 'ArrowLeft':
          if (currentIndex > 0) {
            setSelectionAtIndex(currentIndex - 1);
          }
          handled = true;
          break;
        case 'ArrowRight':
          if (currentIndex < items.length - 1) {
            setSelectionAtIndex(currentIndex + 1);
          }
          handled = true;
          break;
        case 'Escape':
          // Clear selection to close viewer
          clearSelection();
          handled = true;
          break;
      }
    } else {
      // Grid navigation when viewer is closed
      switch (e.key) {
        case 'ArrowLeft':
          setSelectionAtIndex(getNewIndex(currentIndex, 'left'));
          handled = true;
          break;
        case 'ArrowRight':
          setSelectionAtIndex(getNewIndex(currentIndex, 'right'));
          handled = true;
          break;
        case 'ArrowUp':
          setSelectionAtIndex(getNewIndex(currentIndex, 'up'));
          handled = true;
          break;
        case 'ArrowDown':
          setSelectionAtIndex(getNewIndex(currentIndex, 'down'));
          handled = true;
          break;
        case 'Enter':
          if (currentIndex !== -1 && onEnter) {
            onEnter(items[currentIndex]);
            handled = true;
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (currentIndex !== -1 && onDelete) {
            onDelete(items[currentIndex]);
            handled = true;
          }
          break;
        case 'Escape':
          // Clear selection
          clearSelection();
          handled = true;
          break;
      }
    }

    if (handled) {
      e.preventDefault();
    }
  }, [enabled, isViewerOpen, getCurrentIndex, getNewIndex, setSelectionAtIndex, clearSelection, items, onEnter, onDelete]);

  // Attach event listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardNavigation;
