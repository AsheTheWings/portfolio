'use client';

/**
 * useLibraryDropZone - Page-level drag and drop detection
 * Handles file drops anywhere on the page
 */

import { useState, useEffect, useRef } from 'react';
import { ALLOWED_MIME_TYPES, AllowedMimeType } from '../types';

interface UseLibraryDropZoneOptions {
  onFilesAdded: (files: File[]) => void;
  onDragStart?: () => void;
  /** Disable drop zone functionality */
  disabled?: boolean;
}

interface UseLibraryDropZoneResult {
  isDraggingOver: boolean;
}

export function useLibraryDropZone({
  onFilesAdded,
  onDragStart,
  disabled = false,
}: UseLibraryDropZoneOptions): UseLibraryDropZoneResult {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (disabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      
      // Check if dragging files
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingOver(true);
        onDragStart?.();
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Filter to allowed types
        const validFiles = Array.from(files).filter(f => 
          ALLOWED_MIME_TYPES.includes(f.type as AllowedMimeType)
        );
        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [onFilesAdded, onDragStart, disabled]);

  return {
    isDraggingOver,
  };
}
