'use client';

/**
 * LibraryBreadcrumbs - Navigation breadcrumbs for folder hierarchy
 * Supports custom root label for different view modes (Library, Context, etc.)
 */

import { ChevronRight, Home, FolderRoot, type LucideIcon } from 'lucide-react';
import type { Folder } from '../types';
import { cn } from '@/lib/utils';

interface LibraryBreadcrumbsProps {
  breadcrumbs: Folder[];
  onNavigate: (folderId: string | null, folder?: Folder) => void;
  className?: string;
  /** Custom label for root (default: "Library") */
  rootLabel?: string;
  /** Custom icon for root (default: FolderRoot) */
  RootIcon?: LucideIcon;
}

export function LibraryBreadcrumbs({
  breadcrumbs,
  onNavigate,
  className,
  rootLabel = 'Library',
  RootIcon = FolderRoot,
}: LibraryBreadcrumbsProps) {
  return (
    <nav
      aria-label="Folder navigation"
      className={cn('flex items-center gap-1 text-sm', className)}
    >
      {/* Root */}
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-accent',
          breadcrumbs.length === 0 && 'text-foreground font-medium'
        )}
      >
        <RootIcon className="w-4 h-4" />
        <span>{rootLabel}</span>
      </button>

      {/* Breadcrumb items */}
      {breadcrumbs.map((folder, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isHome = folder.is_system && folder.name === 'home';

        return (
          <div key={folder.id} className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <button
              type="button"
              onClick={() => !isLast && onNavigate(folder.id, folder)}
              disabled={isLast}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
                isLast
                  ? 'text-foreground font-medium cursor-default'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {isHome && <Home className="w-3.5 h-3.5" />}
              <span>{folder.name}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export default LibraryBreadcrumbs;
