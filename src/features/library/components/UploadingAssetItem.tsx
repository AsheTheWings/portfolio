'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ImageUp, File as FileIcon, Video, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/features/shared/components/shadcn/progress';

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  finalAssetId?: string;
  previewUrl?: string;   // Blob URL for instant image preview
  folderId?: string;     // Target folder for proper placement
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

type FileType = 'image' | 'video' | 'doc';

function getFileType(file: File): FileType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'doc';
}

function FileTypeIcon({ type }: { type: FileType }) {
  const iconClass = 'h-5 w-5 text-foreground';
  switch (type) {
    case 'image':
      return <ImageUp className={iconClass} />;
    case 'video':
      return <Video className={iconClass} />;
    default:
      return <FileIcon className={iconClass} />;
  }
}

interface UploadingAssetItemProps {
  file: UploadingFile;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export function UploadingAssetItem({ file, onRemove, onRetry }: UploadingAssetItemProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryClick = () => {
    setIsRetrying(true);
    setTimeout(() => {
      onRetry(file.id);
      setIsRetrying(false);
    }, 500);
  };

  return (
    <motion.div
      className="
        bg-surface-1 border border-border-subtle rounded-lg
        p-3 mb-3 flex items-center gap-3
        shadow-depth-sm cursor-pointer
      "
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      whileHover={{
        scale: 1.02,
        y: -2,
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* File icon */}
      <motion.div
        className="flex-shrink-0 w-9 h-9 rounded-md bg-cyan-500/20 flex items-center justify-center"
        animate={{
          rotate: file.status === 'uploading' ? [0, 5, -5, 0] : 0,
        }}
        whileHover={{
          scale: 1.1,
        }}
        transition={{
          rotate: {
            duration: 1.5,
            ease: 'easeInOut',
            repeat: file.status === 'uploading' ? Infinity : 0,
          },
          scale: {
            duration: 0.2,
          },
        }}
      >
        <FileTypeIcon type={getFileType(file.file)} />
      </motion.div>

      {/* File info */}
      <div className={`flex-grow min-w-0 ${file.status === 'completed' ? 'flex items-center gap-2' : ''}`}>
        <div className={`flex items-center ${file.status === 'completed' ? '' : 'justify-between mb-1'}`}>
          <span className="text-sm font-medium text-foreground truncate pr-2">
            {file.file.name}
          </span>
          <div className="flex items-center flex-shrink-0">
            {file.status === 'completed' && (
              <motion.div
                className="flex items-center text-cyan-500"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', duration: 0.8 }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs ml-1 font-medium">Done</span>
              </motion.div>
            )}
            {file.status === 'uploading' && (
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round(file.progress)}%
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {file.status === 'uploading' && (
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1, originX: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-muted rounded-full h-1.5 overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-white rounded-full relative"
              initial={{ width: '0%' }}
              animate={{ width: `${file.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <motion.div
                className="absolute inset-0 bg-white/40"
                animate={{ x: ['-100%', '100%'] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Error message */}
        {file.status === 'error' && (
          <div className="flex items-center text-error text-xs mt-1">
            <AlertCircle className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
            <p className="truncate">{file.error || 'Upload failed'}</p>
          </div>
        )}
      </div>

      {/* File size */}
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {formatBytes(file.file.size)}
      </span>

      {/* Retry button */}
      {file.status === 'error' && (
        <button
          onClick={handleRetryClick}
          disabled={isRetrying}
          className="
            p-1.5 rounded-md text-muted-foreground
            hover:text-foreground hover:bg-muted
            transition-colors disabled:opacity-50
          "
          title="Retry upload"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Remove button - hidden when completed */}
      {file.status !== 'completed' && (
        <button
          onClick={() => onRemove(file.id)}
          disabled={isRetrying}
          className="
            p-1.5 rounded-md text-muted-foreground
            hover:text-error hover:bg-muted
            transition-colors disabled:opacity-50
          "
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

export default UploadingAssetItem;
