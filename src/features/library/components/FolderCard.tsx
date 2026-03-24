'use client';

/**
 * FolderCard - Displays a folder in the library grid
 */

import { memo, MouseEvent } from 'react';
import { Folder, Home, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Folder as FolderType } from '../types';
import { cn } from '@/lib/utils';

interface UploadProgress {
  total: number;
  completed: number;
  progress: number;
}

type FolderCardMode = 'default' | 'picker';

export interface FolderCardProps {
  folder: FolderType;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  uploadProgress?: UploadProgress;
  onClick?: () => void;
  onDoubleClick?: () => void;
  mode?: FolderCardMode;
  /** Show remove button (for context view) */
  showRemoveButton?: boolean;
  /** Callback when remove button clicked */
  onRemove?: () => void;
}

export const FolderCard = memo(function FolderCard({
  folder,
  isSelected = false,
  isMultiSelected = false,
  uploadProgress,
  onClick,
  onDoubleClick,
  mode = 'default',
  showRemoveButton = false,
  onRemove,
}: FolderCardProps) {
  const isPickerMode = mode === 'picker';
  const isHome = folder.isSystem && folder.name === 'home';
  const isUploading = uploadProgress && uploadProgress.total > uploadProgress.completed;
  // Use completed/total as percentage
  const completionPercent = uploadProgress ? Math.round((uploadProgress.completed / uploadProgress.total) * 100) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={false}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onDoubleClick?.();
        }
      }}
      className={cn(
        'group aspect-square relative flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer select-none transition-all duration-150',
        'hover:bg-accent/50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isMultiSelected && 'bg-cyan-500/10 ring-2 ring-cyan-500',
        isSelected && !isMultiSelected && 'bg-accent ring-2 ring-foreground'
      )}
    >
      {/* Folder icon */}
      <div className={cn(
        'flex items-center justify-center rounded-lg transition-colors w-16 h-16 mb-2',
        isHome ? 'text-primary' : 'text-muted-foreground',
        'group-hover:text-foreground'
      )}>
        {isHome ? (
          <Home className="w-10 h-10" />
        ) : (
          <Folder className="w-10 h-10" />
        )}
      </div>

      {/* Folder name */}
      <span className={cn(
        'font-medium text-center truncate max-w-full px-1',
        isPickerMode ? 'text-xs' : 'text-sm',
        isHome && 'text-primary'
      )}>
        {folder.name}
      </span>

      {/* System badge */}
      {isHome && (
        <span className="text-[10px] text-muted-foreground mt-0.5">
          Default
        </span>
      )}

      {/* Upload progress indicator */}
      {isUploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          {/* Circular progress */}
          <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className="stroke-muted"
                strokeWidth="2"
              />
              <motion.circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className="stroke-cyan-500"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={100}
                initial={{ strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 100 - completionPercent }}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
              {completionPercent}%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {uploadProgress?.completed}/{uploadProgress?.total}
          </p>
        </div>
      )}

      {/* Remove from context button */}
      {showRemoveButton && onRemove && (
        <button
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-1 rounded-full bg-background/80 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
          aria-label="Remove from context"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

export default FolderCard;
