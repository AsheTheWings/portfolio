'use client';

import { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Upload, X, FolderOpen } from 'lucide-react';
import { Button } from '@/features/shared/components/shadcn/button';
import { ALLOWED_MIME_TYPES } from '../types';

// Extended File interface with webkitRelativePath (non-standard property)
interface FileWithRelativePath extends File {
  webkitRelativePath: string;
}

interface FileWithRelativePathLocal {
  file: File;
  relativePath: string;
}

// Allowed extensions for filtering folder contents
const ALLOWED_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.pdf'];

interface AssetDropZoneProps {
  /** Called when individual files are added (no folder structure) */
  onFilesAdded: (files: File[]) => void;
  /** Called when a folder is selected (preserves structure) */
  onFolderAdded?: (files: FileWithRelativePathLocal[], rootFolderName: string) => void;
  onClose?: () => void;
  hasUploads?: boolean;
  hasErrors?: boolean;
}

export function AssetDropZone({
  onFilesAdded,
  onFolderAdded,
  onClose,
  hasUploads,
  hasErrors,
}: AssetDropZoneProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAdded(acceptedFiles);
  }, [onFilesAdded]);

  // Handle folder selection with structure preservation
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Filter files to only include allowed types
    const validFiles: FileWithRelativePathLocal[] = [];
    let rootFolderName = '';
    
    for (const file of Array.from(files) as FileWithRelativePath[]) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
      
      // webkitRelativePath: "FolderName/subfolder/file.jpg"
      const relativePath = file.webkitRelativePath || file.name;
      
      // Extract root folder name from first file
      if (!rootFolderName && relativePath.includes('/')) {
        rootFolderName = relativePath.split('/')[0];
      }
      
      validFiles.push({ file, relativePath });
    }
    
    if (validFiles.length > 0) {
      if (onFolderAdded && rootFolderName) {
        // Use folder-aware handler (preserves structure)
        onFolderAdded(validFiles, rootFolderName);
      } else {
        // Fallback to simple file handler
        onFilesAdded(validFiles.map(f => f.file));
      }
    }
    
    // Reset input so same folder can be selected again
    e.target.value = '';
  }, [onFilesAdded, onFolderAdded]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'],
      'video/*': ['.mp4', '.webm'],
      'application/pdf': ['.pdf'],
    },
    noClick: true, // We'll handle clicks manually for better UX
    noKeyboard: true,
  });

  const containerVariants: Variants = {
    initial: {
      opacity: 0,
      scale: 0.95,
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.1,
      },
    },
    uploading: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
        staggerChildren: 0.1,
      },
    },
    error: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    initial: {
      opacity: 0,
      y: 20,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
    uploading: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
    error: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <div {...getRootProps()} className="relative w-full h-full cursor-pointer">
      <motion.div
        className="
          h-full rounded-xl p-8
          flex flex-col items-center justify-center
          bg-surface-1 border-2 border-dashed
          shadow-depth-md
        "
        whileHover={{
          scale: 1.02,
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
        }}
        variants={containerVariants}
        initial="initial"
        animate={hasErrors ? 'error' : hasUploads ? 'uploading' : 'animate'}
      >
        <AnimatePresence>
          {!hasUploads && onClose && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="
                absolute top-3 right-3 p-1.5 rounded-full
                text-muted-foreground hover:text-foreground
                bg-surface-2 hover:bg-muted
                transition-colors duration-150
              "
              aria-label="Close uploader"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.div
          animate={{
            scale: hasUploads ? 0.9 : 1,
            y: hasUploads ? -10 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
            mass: 0.5,
          }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Icon */}
          <motion.div
            variants={itemVariants}
            className="
              w-14 h-14 rounded-full flex items-center justify-center mb-5
              bg-cyan-500/20 text-cyan-900
              dark:bg-cyan-500 dark:text-cyan-50
            "
            whileHover={{
              scale: 1.1,
              rotate: [0, -10, 10, -10, 0],
              transition: { duration: 0.5 },
            }}
          >
            <Upload className="w-6 h-6" />
          </motion.div>

          {/* Title */}
          <motion.h3
            variants={itemVariants}
            className="text-lg font-semibold text-foreground mb-2"
          >
            {hasErrors
              ? 'Upload Error'
              : hasUploads
              ? 'Uploading...'
              : isDragActive
              ? 'Drop files here'
              : 'Upload Assets'}
          </motion.h3>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-sm text-muted-foreground mb-5 max-w-[280px]"
          >
            {hasErrors
              ? 'Some uploads failed. Retry or add more files.'
              : hasUploads
              ? 'You can add more files to the queue.'
              : 'Drag and drop files or folders here, or click to browse.'}
          </motion.p>

          <input {...getInputProps()} />
          
          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            onChange={handleFolderSelect}
            className="hidden"
            /* @ts-expect-error - webkitdirectory is non-standard but widely supported */
            webkitdirectory=""
            directory=""
            multiple
          />

          {/* Buttons */}
          <motion.div variants={itemVariants} className="flex gap-2">
            <Button variant="default" size="sm" onClick={open}>
              {hasUploads ? 'Add Files' : 'Choose Files'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="gap-1.5"
            >
              <FolderOpen className="w-4 h-4" />
              Folder
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default AssetDropZone;
