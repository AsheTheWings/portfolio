'use client';

import { useState, memo, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Check, X, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import type { Asset } from '../types';
import type { UploadingFile } from './UploadingAssetItem';
import IconImage from '@/features/shared/icons/IconImage';
import { IconVideo } from '@/features/shared/icons/IconVideo';

export interface AssetCardProps {
  asset?: Asset;
  uploadingFile?: UploadingFile;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  onSelect?: () => void;
  onCancelUpload?: () => void;
  onRetryUpload?: () => void;
  isLoading?: boolean;
  /** Show remove button (for context view) */
  showRemoveButton?: boolean;
  /** Callback when remove button clicked */
  onRemove?: () => void;
}

function AssetCardComponent({
  asset,
  uploadingFile,
  isSelected = false,
  isMultiSelected = false,
  onSelect,
  onCancelUpload,
  onRetryUpload,
  isLoading = false,
  showRemoveButton = false,
  onRemove,
}: AssetCardProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [useUnoptimized, setUseUnoptimized] = useState(false);

  // Determine file type from either asset or uploading file
  const getFileType = (): 'image' | 'video' | 'document' => {
    if (asset) {
      if (asset.mimeType?.startsWith('video/')) return 'video';
      if (asset.mimeType?.startsWith('image/')) return 'image';
      return 'document';
    }
    if (uploadingFile) {
      if (uploadingFile.file.type.startsWith('video/')) return 'video';
      if (uploadingFile.file.type.startsWith('image/')) return 'image';
      return 'document';
    }
    return 'image';
  };

  const fileType = getFileType();

  // Render uploading state
  if (uploadingFile) {
    const { progress, status: uploadStatus, error, previewUrl } = uploadingFile;
    const isUploading = uploadStatus === 'uploading' || uploadStatus === 'pending' || uploadStatus === 'processing';
    const isError = uploadStatus === 'error';
    const isCompleted = uploadStatus === 'completed';

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="relative aspect-square rounded-lg overflow-hidden bg-surface-1 border border-border-subtle"
      >
        {/* Preview background - full opacity when completed */}
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {previewUrl && fileType === 'image' ? (
            <img
              src={previewUrl}
              alt="Upload preview"
              className={`w-full h-full object-cover transition-opacity duration-200 ${isCompleted ? 'opacity-100' : 'opacity-50'}`}
            />
          ) : (
            <>
              {fileType === 'video' && <IconVideo className="w-12 h-12 text-muted-foreground/50" />}
              {fileType === 'image' && <IconImage size="48" className="text-muted-foreground/50" />}
              {fileType === 'document' && <FileText className="w-12 h-12 text-muted-foreground/50" />}
            </>
          )}
        </div>

        {/* Progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
            {/* Circular progress */}
            <div className="relative w-14 h-14">
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
                  animate={{ strokeDashoffset: 100 - progress }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground truncate max-w-[90%] px-2">
              {uploadingFile.file.name}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-xs text-destructive text-center px-2 mb-3">
              {error || 'Upload failed'}
            </p>
            <div className="flex gap-2">
              {onRetryUpload && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetryUpload(); }}
                  className="p-1.5 rounded-full bg-surface-1 hover:bg-muted text-foreground transition-colors"
                  title="Retry"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {onCancelUpload && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancelUpload(); }}
                  className="p-1.5 rounded-full bg-surface-1 hover:bg-muted text-destructive transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cancel button (during upload, disabled at 100%) */}
        {isUploading && onCancelUpload && progress < 100 && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancelUpload(); }}
            className="absolute top-2 right-2 p-1 rounded-full bg-background/60 hover:bg-background text-muted-foreground hover:text-destructive transition-colors"
            title="Cancel upload"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    );
  }

  if (isLoading || !asset) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border-subtle flex items-center justify-center animate-pulse">
        <IconImage size="48" className="text-muted-foreground/50" />
      </div>
    );
  }

  const isVideo = fileType === 'video';

  const getImageSrc = () => {
    if (imageSrc) return imageSrc;
    if (isVideo) {
      // Videos should always use thumbnail or placeholder, never the video URL
      return asset.thumbnailUrl || '/video-placeholder.svg';
    }
    return asset.thumbnailUrl || asset.url;
  };

  const handleImageError = () => {
    if (!useUnoptimized) {
      setUseUnoptimized(true);
      return;
    }
    if (!imageSrc && asset.thumbnailUrl && asset.url && asset.thumbnailUrl !== asset.url && !isVideo) {
      // Only try fallback for images, not videos
      setImageSrc(asset.url);
      setUseUnoptimized(false);
      return;
    }
    setStatus('error');
  };

  // Multi-selection uses cyan, single selection uses foreground
  const borderClass = isMultiSelected
    ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-background'
    : isSelected
      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
      : '';

  return (
    <div
      data-id={`asset-card-${asset.id}`}
      draggable={false}
      className={`
        asset-card-wrapper relative aspect-square rounded-lg overflow-hidden cursor-pointer select-none
        transition-all duration-200 ease-out
        bg-surface-1 border border-border-subtle
        hover:shadow-depth-md hover:scale-[1.02]
        ${borderClass}
        ${isSelected ? 'scale-[1.02]' : ''}
      `}
      onClick={onSelect}
    >
      {/* Loading/Error placeholder */}
      {status !== 'loaded' && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          {isVideo ? (
            <IconVideo className="w-12 h-12 text-muted-foreground/50" />
          ) : (
            <IconImage size="48" className="text-muted-foreground/50" />
          )}
        </div>
      )}

      <Image
        src={getImageSrc()}
        alt={asset.altText || asset.fileName}
        className={`
          w-full h-full object-cover transition-opacity duration-300 pointer-events-none
          ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}
        `}
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 20vw, 15vw"
        unoptimized={useUnoptimized}
        loading="lazy"
        draggable={false}
        onLoad={() => setStatus('loaded')}
        onError={handleImageError}
      />

      {/* Video play indicator */}
      {isVideo && status === 'loaded' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-5 h-5 text-foreground ml-0.5" />
          </div>
        </div>
      )}

      {/* Multi-selection indicator */}
      {isMultiSelected && status === 'loaded' && (
        <div className="absolute top-2 left-2">
          <div className="w-5 h-5 rounded bg-cyan-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      )}

      {/* Filename overlay on hover */}
      <div className="
        absolute bottom-0 left-0 right-0 p-3
        bg-gradient-to-t from-black/60 to-transparent
        opacity-0 translate-y-2 transition-all duration-200
        group-hover:opacity-100 group-hover:translate-y-0
        pointer-events-none
      ">
        <p className="text-xs font-medium text-white truncate">
          {asset.fileName}
        </p>
      </div>

      {/* Remove from context button */}
      {showRemoveButton && onRemove && (
        <button
          onClick={(e) => {
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
}

const arePropsEqual = (prev: AssetCardProps, next: AssetCardProps) => {
  return (
    prev.asset?.id === next.asset?.id &&
    prev.uploadingFile?.id === next.uploadingFile?.id &&
    prev.uploadingFile?.progress === next.uploadingFile?.progress &&
    prev.uploadingFile?.status === next.uploadingFile?.status &&
    prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.isLoading === next.isLoading &&
    prev.showRemoveButton === next.showRemoveButton
  );
};

export const AssetCard = memo(AssetCardComponent, arePropsEqual);
export default AssetCard;
