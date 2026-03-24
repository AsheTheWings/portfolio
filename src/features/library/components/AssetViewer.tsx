
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { X, Maximize, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Asset } from '../types';

interface AssetViewerProps {
  focusedId: string | null;
  assets: Asset[] | undefined;
  onClose: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function AssetViewer({
  focusedId,
  assets,
  onClose,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
}: AssetViewerProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);

  const asset = useMemo(() => {
    if (!focusedId || !assets) return null;
    return assets.find(a => a.id === focusedId) || null;
  }, [focusedId, assets]);

  useEffect(() => {
    setStatus('loading');
  }, [asset?.id]);

  if (!asset) return null;

  const isVideo = asset.mime_type?.startsWith('video/');

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  return (
    <div
      className="asset-viewer fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Asset container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-black group"
        style={{ width: '70vw', maxWidth: '1200px', aspectRatio: '16/9' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls overlay */}
        <div className="
          absolute top-3 right-3 z-10 flex items-center gap-2
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
        ">
          {status === 'loading' && (
            <div className="p-2 text-white/80">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status === 'loaded' && !isVideo && (
            <button
              onClick={handleFullscreen}
              className="
                p-2.5 rounded-lg
                bg-black/40 hover:bg-black/60 backdrop-blur-md
                text-white hover:text-white
                border border-white/20 hover:border-white/40
                transition-all duration-200
                shadow-lg
              "
              title="Toggle fullscreen (F)"
            >
              <Maximize className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="
              p-2.5 rounded-lg
              bg-black/40 hover:bg-black/60 backdrop-blur-md
              text-white hover:text-white
              border border-white/20 hover:border-white/40
              transition-all duration-200
              shadow-lg
            "
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Previous button - only render if content exists */}
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onPrevious) onPrevious();
            }}
            className="
              absolute left-4 top-1/2 -translate-y-1/2 z-10
              p-3 rounded-lg
              bg-black/40 hover:bg-black/60 backdrop-blur-md
              text-white hover:text-white
              border border-white/20 hover:border-white/40
              opacity-0 group-hover:opacity-100
              transition-all duration-200
              cursor-pointer
              shadow-lg
            "
            title="Previous (←)"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {/* Asset display */}
        {isVideo ? (
          <video
            src={asset.url}
            controls
            autoPlay
            className="h-full w-full object-contain"
            onLoadedData={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        ) : (
          <img
            src={asset.url}
            alt={asset.alt_text || asset.file_name}
            className="h-full w-full object-contain"
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        )}

        {/* Next button - only render if content exists */}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNext) onNext();
            }}
            className="
              absolute right-4 top-1/2 -translate-y-1/2 z-10
              p-3 rounded-lg
              bg-black/40 hover:bg-black/60 backdrop-blur-md
              text-white hover:text-white
              border border-white/20 hover:border-white/40
              opacity-0 group-hover:opacity-100
              transition-all duration-200
              cursor-pointer
              shadow-lg
            "
            title="Next (→)"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        {/* Asset info */}
        <div className="
          absolute bottom-0 left-0 right-0 p-4
          bg-gradient-to-t from-black/70 to-transparent
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
        ">
          <p className="text-white text-sm font-medium truncate">
            {asset.file_name}
          </p>
          {asset.alt_text && (
            <p className="text-white/70 text-xs mt-1 truncate">
              {asset.alt_text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssetViewer;
