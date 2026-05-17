'use client';

/**
 * LightAssetGrid - Lightweight grid for displaying library items
 * 
 * Features:
 * - Displays thumbnails for assets, icons for folders
 * - Click to select/focus item
 * - Double-click to open asset viewer
 * - Right-click context menu with "View in library"
 * - Compact design for embedding in messages
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Folder, Image as ImageIcon, Video, FileText, File, ExternalLink, Copy } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@portfolio/ui/components/shadcn/context-menu';
import { Skeleton } from '@portfolio/ui/components/shadcn/skeleton';
import { AssetViewer } from './AssetViewer';
import { formatLibraryPath } from '@portfolio/ui/utils/libraryMentionParser';
import type { Asset } from '../types';

export interface LightAssetItem {
  id: string;
  name: string;
  path: string;
  type: 'asset' | 'folder';
  thumbnailUrl?: string;
  fileType?: 'image' | 'video' | 'document';
  storageUrl?: string;
  mimeType?: string;
}

interface LightAssetGridProps {
  /** Items to display */
  items: LightAssetItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Expected number of items (for skeleton placeholders during loading) */
  expectedCount?: number;
  /** Error message */
  error?: string | null;
  /** Maximum items to show before collapsing */
  maxVisible?: number;
  /** Currently focused item path (for highlight) */
  focusedPath?: string | null;
  /** Callback when item is clicked */
  onItemClick?: (item: LightAssetItem) => void;
  /** Callback when "View in library" is clicked */
  onViewInLibrary?: (item: LightAssetItem) => void;
  /** Callback to clear focus (called on Escape) */
  onClearFocus?: () => void;
  /** Whether this is in a user message (affects styling) */
  isUserMessage?: boolean;
  /** Custom class */
  className?: string;
}

function getItemIcon(item: LightAssetItem, className: string = 'w-6 h-6') {
  if (item.type === 'folder') {
    return <Folder className={`${className} text-amber-500`} />;
  }
  switch (item.fileType) {
    case 'image':
      return <ImageIcon className={`${className} text-blue-500`} />;
    case 'video':
      return <Video className={`${className} text-purple-500`} />;
    case 'document':
      return <FileText className={`${className} text-green-500`} />;
    default:
      return <File className={`${className} text-gray-500`} />;
  }
}
/**
 * Get cell size based on item count
 * Few items = larger cells, many items = smaller cells
 */
function getCellSize(itemCount: number): { size: number; iconSize: string; textSize: string; nameLimit: number } {
  if (itemCount <= 2) {
    return { size: 160, iconSize: 'w-10 h-10', textSize: 'text-base', nameLimit: 16 };
  } else if (itemCount <= 4) {
    return { size: 120, iconSize: 'w-10 h-10', textSize: 'text-sm', nameLimit: 14 };
  } else if (itemCount <= 8) {
    return { size: 104, iconSize: 'w-9 h-9', textSize: 'text-xs', nameLimit: 12 };
  } else if (itemCount <= 12) {
    return { size: 88, iconSize: 'w-7 h-7', textSize: 'text-[11px]', nameLimit: 10 };
  } else {
    return { size: 72, iconSize: 'w-6 h-6', textSize: 'text-[10px]', nameLimit: 8 };
  }
}

function LightAssetCard({
  item,
  isUserMessage,
  isFocused,
  cellSize,
  iconSize,
  textSize,
  nameLimit,
  onClick,
  onDoubleClick,
  onViewInLibrary,
}: {
  item: LightAssetItem;
  isUserMessage?: boolean;
  isFocused?: boolean;
  cellSize: number;
  iconSize: string;
  textSize: string;
  nameLimit: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onViewInLibrary?: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          style={{ width: cellSize, height: cellSize }}
          className={`
            group relative flex flex-col items-center justify-center
            rounded-lg overflow-hidden
            transition-all duration-150
            ${isFocused 
              ? 'ring-2 ring-primary ring-offset-1' 
              : ''
            }
            ${isUserMessage 
              ? 'bg-white/10 hover:bg-white/20 border border-white/20' 
              : 'bg-muted hover:bg-accent border border-border'
            }
          `}
          title={item.name}
        >
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-1">
              {getItemIcon(item, iconSize)}
              <span className={`${textSize} truncate max-w-full px-1 ${isUserMessage ? 'text-white/80' : 'text-muted-foreground'}`}>
                {item.name.length > nameLimit ? item.name.slice(0, nameLimit - 1) + '…' : item.name}
              </span>
            </div>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onViewInLibrary} className="gap-2">
          <ExternalLink className="w-4 h-4" />
          View in Library
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={() => navigator.clipboard.writeText(formatLibraryPath(item.path))} 
          className="gap-2"
        >
          <Copy className="w-4 h-4" />
          Copy Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Convert LightAssetItem to Asset for AssetViewer
 */
function itemToAsset(item: LightAssetItem): Asset {
  return {
    id: item.id,
    userId: '',
    folderId: '',
    fileName: item.name,
    storagePath: '',
    url: item.storageUrl || item.thumbnailUrl || '',
    fileType: item.fileType || 'image',
    mimeType: item.mimeType || null,
    sizeKb: null,
    altText: null,
    thumbnailUrl: item.thumbnailUrl || null,
    metadata: {},
    createdAt: '',
    updatedAt: '',
  };
}

export function LightAssetGrid({
  items,
  isLoading = false,
  expectedCount = 0,
  error = null,
  maxVisible = 17,
  focusedPath = null,
  onItemClick,
  onViewInLibrary,
  onClearFocus,
  isUserMessage = false,
  className = '',
}: LightAssetGridProps) {
  const [showAll, setShowAll] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  
  // Listen for global collapse event to clear focus
  useEffect(() => {
    const handleCollapseAll = () => {
      onClearFocus?.();
    };
    
    window.addEventListener('agent:collapseAll', handleCollapseAll);
    return () => window.removeEventListener('agent:collapseAll', handleCollapseAll);
  }, [onClearFocus]);
  
  // Convert items to Asset[] for AssetViewer
  const assetItems = useMemo(() => 
    items.filter(i => i.type === 'asset').map(itemToAsset),
    [items]
  );
  
  // Find current index for navigation
  const currentIndex = viewerId ? assetItems.findIndex(a => a.id === viewerId) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < assetItems.length - 1;
  
  // Handle click - if item is focused, open viewer
  const handleItemClick = useCallback((item: LightAssetItem) => {
    if (focusedPath === item.path && item.type === 'asset') {
      // Clicking focused asset opens viewer
      setViewerId(item.id);
    } else {
      // Normal click
      onItemClick?.(item);
    }
  }, [focusedPath, onItemClick]);
  
  const handleDoubleClick = useCallback((item: LightAssetItem) => {
    if (item.type === 'asset') {
      setViewerId(item.id);
    }
  }, []);
  
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setViewerId(assetItems[currentIndex - 1].id);
    }
  }, [currentIndex, assetItems]);
  
  const handleNext = useCallback(() => {
    if (currentIndex < assetItems.length - 1) {
      setViewerId(assetItems[currentIndex + 1].id);
    }
  }, [currentIndex, assetItems]);
  
  // Nothing to show
  if (!isLoading && items.length === 0 && !error) {
    return null;
  }
  
  const visibleItems = showAll ? items : items.slice(0, maxVisible);
  const hiddenCount = items.length - maxVisible;
  
  // Calculate cell size based on visible item count
  const { size: cellSize, iconSize, textSize, nameLimit } = getCellSize(visibleItems.length);
  
  return (
    <div className={`mt-2 ${className}`}>
      {isLoading ? (
        (() => {
          const count = Math.min(expectedCount || 3, maxVisible);
          const { size: skeletonSize } = getCellSize(count);
          return (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: count }, (_, i) => (
                <Skeleton
                  key={i}
                  className={`rounded-lg ${isUserMessage ? 'bg-white/10' : ''}`}
                  style={{ width: skeletonSize, height: skeletonSize }}
                />
              ))}
            </div>
          );
        })()
      ) : error ? (
        <div className="text-xs text-destructive">{error}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visibleItems.map((item) => (
            <LightAssetCard
              key={item.id}
              item={item}
              isUserMessage={isUserMessage}
              isFocused={focusedPath === item.path}
              cellSize={cellSize}
              iconSize={iconSize}
              textSize={textSize}
              nameLimit={nameLimit}
              onClick={() => handleItemClick(item)}
              onDoubleClick={() => handleDoubleClick(item)}
              onViewInLibrary={() => onViewInLibrary?.(item)}
            />
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              style={{ width: cellSize, height: cellSize }}
              className={`
                flex items-center justify-center rounded-lg
                ${textSize} font-medium transition-colors
                ${isUserMessage 
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                  : 'bg-muted hover:bg-accent text-muted-foreground border border-border'
                }
              `}
            >
              +{hiddenCount} more
            </button>
          )}
        </div>
      )}
      
      {/* Asset Viewer */}
      <AssetViewer
        focusedId={viewerId}
        assets={assetItems}
        onClose={() => setViewerId(null)}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </div>
  );
}
