'use client';

/**
 * LibraryContextMenu - Context menus for library items and grid
 */

import { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@portfolio/ui/components/shadcn/context-menu';
import { 
  Copy, 
  Scissors,
  ClipboardPaste, 
  Trash2, 
  PencilLine, 
  RefreshCw, 
  FolderPlus,
  Download,
  BookOpen,
} from 'lucide-react';
import { formatLibraryPath } from '@portfolio/ui/utils/libraryMentionParser';

interface ItemContextMenuProps {
  children: ReactNode;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onCopyPath?: () => void;
  onSelect?: () => void;
  onOpenMangaMode?: () => void;
  canPaste: boolean;
  itemPath?: string;
  isSystemFolder?: boolean;
  isFolder?: boolean;
  isMultiSelection?: boolean;
  isLocked?: boolean;
}

/**
 * Context menu for assets and folders
 */
export function ItemContextMenu({
  children,
  onRename,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onDownload,
  onCopyPath,
  onSelect,
  onOpenMangaMode,
  canPaste,
  itemPath,
  isSystemFolder = false,
  isFolder = false,
  isMultiSelection = false,
  isLocked = false,
}: ItemContextMenuProps) {
  const isMutationDisabled = isSystemFolder || isLocked;
  return (
    <ContextMenu onOpenChange={(open) => open && onSelect?.()}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {!isMultiSelection && (
          <ContextMenuItem 
            onClick={onRename}
            disabled={isMutationDisabled}
            className="gap-2"
          >
            <PencilLine className="w-4 h-4" />
            Rename
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={onCopy} className="gap-2">
          <Copy className="w-4 h-4" />
          Copy
        </ContextMenuItem>
        {itemPath && (
          <ContextMenuItem 
            onClick={onCopyPath || (() => navigator.clipboard.writeText(formatLibraryPath(itemPath)))}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Path
          </ContextMenuItem>
        )}
        <ContextMenuItem 
          onClick={onCut} 
          disabled={isMutationDisabled}
          className="gap-2"
        >
          <Scissors className="w-4 h-4" />
          Cut
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={onPaste}
          disabled={!canPaste || isLocked}
          className="gap-2"
        >
          <ClipboardPaste className="w-4 h-4" />
          Paste
        </ContextMenuItem>
        {!isFolder && onDownload && (
          <ContextMenuItem onClick={onDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </ContextMenuItem>
        )}
        {isFolder && onOpenMangaMode && (
          <ContextMenuItem onClick={onOpenMangaMode} className="gap-2">
            <BookOpen className="w-4 h-4" />
            Open in Manga Mode
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={onDelete}
          disabled={isMutationDisabled}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface GridContextMenuProps {
  children: ReactNode;
  onRefresh: () => void;
  onPaste: () => void;
  onCreateFolder: () => void;
  canPaste: boolean;
  isLocked?: boolean;
}

/**
 * Context menu for empty grid area
 */
export function GridContextMenu({
  children,
  onRefresh,
  onPaste,
  onCreateFolder,
  canPaste,
  isLocked = false,
}: GridContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={onPaste}
          disabled={!canPaste || isLocked}
          className="gap-2"
        >
          <ClipboardPaste className="w-4 h-4" />
          Paste
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={onCreateFolder} 
          disabled={isLocked}
          className="gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          Create Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
