'use client';

/**
 * LibraryPathBrowser - Reusable dropdown for browsing library by path
 * 
 * Features:
 * - Folder tree navigation
 * - Path-based search (Photos/sunset)
 * - Global library search
 * - Keyboard navigation (arrow keys, Enter, Tab, Escape)
 * - Customizable selection callback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, Image as ImageIcon, Video, FileText, File, Loader2, ChevronRight, Search } from 'lucide-react';
import { useLibraryPathBrowser } from '../hooks/useLibraryPathBrowser';
import type { LibraryItem, FolderTreeNode } from '../types';

interface LibraryPathBrowserProps {
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Query text (e.g., "Photos/sunset") */
  query: string;
  /** Callback when item is selected */
  onSelect: (item: LibraryItem, path: string) => void;
  /** Callback to close dropdown */
  onClose: () => void;
  /** Custom container class */
  containerClassName?: string;
}

/**
 * Normalize folder path for display
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\/+/, '')  // Remove leading slashes
    .replace(/\/+$/, ''); // Remove trailing slashes
}

/**
 * Get icon for library item
 */
function getItemIcon(item: LibraryItem) {
  if (item.type === 'folder') {
    return <Folder className="w-4 h-4 text-amber-500" />;
  }
  switch (item.fileType) {
    case 'image':
      return <ImageIcon className="w-4 h-4 text-blue-500" />;
    case 'video':
      return <Video className="w-4 h-4 text-purple-500" />;
    case 'document':
      return <FileText className="w-4 h-4 text-green-500" />;
    default:
      return <File className="w-4 h-4 text-gray-500" />;
  }
}

/**
 * Flatten folder tree for keyboard navigation
 */
function flattenTree(tree: FolderTreeNode[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  const traverse = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      items.push({
        id: node.id,
        name: node.name,
        type: 'folder',
        path: normalizePath(node.path),
        createdAt: '',
        updatedAt: '',
        assetsCount: node.assetsCount,
      });
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  };
  traverse(tree);
  return items;
}

export function LibraryPathBrowser({
  isOpen,
  query,
  onSelect,
  onClose,
  containerClassName = 'absolute bottom-full left-0 right-0 mb-2 z-[100]',
}: LibraryPathBrowserProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    items,
    folderTree,
    currentPath,
    isLoading,
    mode,
    navigateToPath,
    reset,
  } = useLibraryPathBrowser({
    query,
    isOpen,
    debounceMs: 150,
  });

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      reset();
      setSelectedIndex(0);
    }
  }, [isOpen, reset]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items, folderTree]);

  // Scroll selected item into view using callback ref
  const scrollSelectedIntoView = useCallback((element: HTMLButtonElement | null) => {
    if (element) {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  const displayItems = mode === 'tree' ? flattenTree(folderTree) : items;

  const handleItemSelect = useCallback((item: LibraryItem) => {
    const path = normalizePath(item.path || item.name);
    onSelect(item, path);
  }, [onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const maxIndex = displayItems.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayItems[selectedIndex]) {
          handleItemSelect(displayItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        if (displayItems[selectedIndex]) {
          const item = displayItems[selectedIndex];
          if (item.type === 'folder') {
            // Tab into folder
            navigateToPath(normalizePath(item.path || item.name));
          } else {
            // Tab selects file (same as Enter)
            handleItemSelect(item);
          }
        }
        break;
    }
  }, [isOpen, displayItems, selectedIndex, handleItemSelect, onClose, navigateToPath]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  // Render folder tree recursively
  const renderTreeNode = (node: FolderTreeNode, depth: number = 0, flatIndex: number): { element: React.ReactElement; nextIndex: number } => {
    const isSelected = selectedIndex === flatIndex;
    const itemPath = normalizePath(node.path);
    let currentIndex = flatIndex;

    const nodeElement = (
      <button
        key={node.id}
        ref={isSelected ? scrollSelectedIntoView : undefined}
        onClick={() => handleItemSelect({
          id: node.id,
          name: node.name,
          type: 'folder',
          path: itemPath,
          createdAt: '',
          updatedAt: '',
          assetsCount: node.assetsCount,
        })}
        className={`
          w-full flex items-center gap-2 px-3 py-2 text-left text-sm
          hover:bg-accent transition-colors
          ${isSelected ? 'bg-accent' : ''}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="truncate flex-1">{node.name}</span>
        {node.assetsCount > 0 && (
          <span className="text-xs text-muted-foreground">{node.assetsCount}</span>
        )}
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </button>
    );

    currentIndex++;

    // Render children
    const childElements: React.ReactElement[] = [];
    for (const child of node.children) {
      const result = renderTreeNode(child, depth + 1, currentIndex);
      childElements.push(result.element);
      currentIndex = result.nextIndex;
    }

    return {
      element: (
        <div key={node.id}>
          {nodeElement}
          {childElements}
        </div>
      ),
      nextIndex: currentIndex,
    };
  };

  return (
    <div ref={containerRef} className={containerClassName}>
      <div className="bg-popover border border-border rounded-lg shadow-lg max-h-[300px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 text-sm text-muted-foreground">
          {mode === 'search' && currentPath ? (
            <>
              <Folder className="w-4 h-4" />
              <span>{currentPath}</span>
            </>
          ) : mode === 'search' && query ? (
            <>
              <Search className="w-4 h-4" />
              <span>Search: {query}</span>
            </>
          ) : (
            <>
              <Folder className="w-4 h-4" />
              <span>Library</span>
            </>
          )}
          {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 scrollbar-inner">
          {mode === 'tree' ? (
            // Folder tree view
            folderTree.length > 0 ? (
              <div className="py-1">
                {(() => {
                  let index = 0;
                  return folderTree.map(node => {
                    const result = renderTreeNode(node, 0, index);
                    index = result.nextIndex;
                    return result.element;
                  });
                })()}
              </div>
            ) : !isLoading ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No folders found
              </div>
            ) : null
          ) : (
            // Search/list results
            items.length > 0 ? (
              <div className="py-1">
                {items.map((item, index) => (
                  <button
                    key={item.id}
                    ref={selectedIndex === index ? scrollSelectedIntoView : undefined}
                    onClick={() => handleItemSelect(item)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                      hover:bg-accent transition-colors
                      ${selectedIndex === index ? 'bg-accent' : ''}
                    `}
                  >
                    {getItemIcon(item)}
                    <span className="truncate flex-1">{item.name}</span>
                    {item.type === 'folder' && (
                      <>
                        {item.assetsCount !== undefined && item.assetsCount > 0 && (
                          <span className="text-xs text-muted-foreground">{item.assetsCount}</span>
                        )}
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </>
                    )}
                    {item.type === 'asset' && item.fileType && (
                      <span className="text-xs text-muted-foreground capitalize">{item.fileType}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : !isLoading ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No results found
              </div>
            ) : null
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground flex gap-3">
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> select</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> autocomplete</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export default LibraryPathBrowser;
