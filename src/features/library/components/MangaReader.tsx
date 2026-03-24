'use client';

/**
 * MangaReader - Full viewport manga/comic reader
 * 
 * Features:
 * - Full viewport display with vertically stacked images
 * - Zoom controls (fit width, fit height, custom zoom levels)
 * - Background color adjustment (black, white, sepia, custom)
 * - Smooth scrolling with keyboard navigation
 * - Page progress indicator
 * - Fullscreen support
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronUp,
  ChevronDown,
  Palette,
  ArrowUpToLine,
  ArrowDownToLine,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/features/shared/components/shadcn/popover';
import { Button } from '@/features/shared/components/shadcn/button';
import type { Asset } from '../types';

interface MangaReaderProps {
  /** Folder name for display */
  folderName: string;
  /** Image assets to display (pre-filtered for images only) */
  images: Asset[];
  /** Callback when reader is closed */
  onClose: () => void;
}

type FitMode = 'width' | 'height' | 'custom';
type BgColor = 'black' | 'white' | 'sepia' | 'gray' | 'custom';

const BG_COLORS: Record<Exclude<BgColor, 'custom'>, string> = {
  black: '#000000',
  white: '#ffffff',
  sepia: '#f5e6c8',
  gray: '#1a1a1a',
};

export function MangaReader({ folderName, images, onClose }: MangaReaderProps) {
  // Display settings
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [bgColor, setBgColor] = useState<BgColor>('black');
  const [customBgColor, setCustomBgColor] = useState('#000000');
  
  // Navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Sort images by filename for consistent order
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => 
      a.fileName.localeCompare(b.fileName, undefined, { numeric: true })
    );
  }, [images]);
  
  // Resolved background color
  const resolvedBgColor = bgColor === 'custom' ? customBgColor : BG_COLORS[bgColor];
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'Home':
          e.preventDefault();
          scrollToImage(0);
          break;
        case 'End':
          e.preventDefault();
          scrollToImage(sortedImages.length - 1);
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          setZoom(100);
          setFitMode('custom');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleFullscreen();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, sortedImages.length]);
  
  // Auto-focus container for native keyboard scrolling
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      containerRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Track scroll position to update current image index
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollCenter = scrollTop + containerHeight / 2;
      
      // Find which image is at the center of the viewport
      let accumulatedHeight = 0;
      for (let i = 0; i < imageRefs.current.length; i++) {
        const imageEl = imageRefs.current[i];
        if (!imageEl) continue;
        
        const imageHeight = imageEl.offsetHeight;
        if (accumulatedHeight + imageHeight > scrollCenter) {
          setCurrentImageIndex(i);
          break;
        }
        accumulatedHeight += imageHeight;
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Scroll helpers
  const scrollByAmount = useCallback((amount: number) => {
    containerRef.current?.scrollBy({ top: amount, behavior: 'smooth' });
  }, []);
  
  const scrollToImage = useCallback((index: number) => {
    const imageEl = imageRefs.current[index];
    if (imageEl) {
      imageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentImageIndex(index);
    }
  }, []);
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 300));
    setFitMode('custom');
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 25));
    setFitMode('custom');
  }, []);
  
  const handleFitWidth = useCallback(() => {
    setFitMode('width');
    setZoom(100);
  }, []);
  
  const handleFitHeight = useCallback(() => {
    setFitMode('height');
    setZoom(100);
  }, []);
  
  // Fullscreen
  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);
  
  // Image load tracking
  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
  }, []);
  
  // Image width style based on fit mode
  const getImageStyle = useCallback((): React.CSSProperties => {
    switch (fitMode) {
      case 'width':
        return { width: '100%', maxWidth: '100%', height: 'auto' };
      case 'height':
        return { width: 'auto', maxWidth: 'none', height: '100vh' };
      case 'custom':
        return { width: `${zoom}%`, maxWidth: 'none', height: 'auto' };
    }
  }, [fitMode, zoom]);

  if (sortedImages.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="text-lg mb-4">No images found in this folder</p>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: resolvedBgColor }}
    >
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm text-white">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium truncate max-w-[200px]">{folderName}</h2>
          <span className="text-xs text-white/60">
            {currentImageIndex + 1} / {sortedImages.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs w-12 text-center">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          
          {/* Fit mode buttons */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-1 py-1">
            <button
              onClick={handleFitWidth}
              className={`p-1 rounded transition-colors ${fitMode === 'width' ? 'bg-white/30' : 'hover:bg-white/20'}`}
              title="Fit width"
            >
              <ArrowUpToLine className="w-4 h-4 rotate-90" />
            </button>
            <button
              onClick={handleFitHeight}
              className={`p-1 rounded transition-colors ${fitMode === 'height' ? 'bg-white/30' : 'hover:bg-white/20'}`}
              title="Fit height"
            >
              <ArrowDownToLine className="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          {/* Background color picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-2 hover:bg-white/20 rounded transition-colors"
                title="Background color"
              >
                <Palette className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 z-[10000]" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium">Background Color</p>
                <div className="flex gap-2">
                  {(Object.keys(BG_COLORS) as Exclude<BgColor, 'custom'>[]).map((color) => (
                    <button
                      key={color}
                      onClick={() => setBgColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        bgColor === color ? 'border-primary scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: BG_COLORS[color] }}
                      title={color.charAt(0).toUpperCase() + color.slice(1)}
                    />
                  ))}
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => {
                      setCustomBgColor(e.target.value);
                      setBgColor('custom');
                    }}
                    className="w-8 h-8 rounded-full cursor-pointer border-2 border-transparent"
                    title="Custom color"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-white/20 rounded transition-colors"
            title="Fullscreen (F)"
          >
            <Maximize className="w-4 h-4" />
          </button>
          
          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Image container - vertical scroll */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto outline-none focus:outline-none"
        style={{ backgroundColor: resolvedBgColor }}
        onClick={() => containerRef.current?.focus()}
      >
        <div className={`flex flex-col ${fitMode === 'height' ? 'items-start' : 'items-center'}`}>
          {sortedImages.map((image, index) => (
            <div
              key={image.id}
              ref={(el) => { imageRefs.current[index] = el; }}
              className="relative"
              style={getImageStyle()}
            >
              {/* Loading placeholder */}
              {!loadedImages.has(index) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <img
                src={image.url}
                alt={image.altText || image.fileName}
                className="block w-full h-auto"
                loading={index < 3 ? 'eager' : 'lazy'}
                onLoad={() => handleImageLoad(index)}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Navigation buttons (floating) */}
      <div className="fixed right-4 bottom-1/2 translate-y-1/2 flex flex-col gap-2 opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={() => scrollToImage(Math.max(0, currentImageIndex - 1))}
          disabled={currentImageIndex === 0}
          className="p-3 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full text-white transition-colors"
          title="Previous page (↑)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollToImage(Math.min(sortedImages.length - 1, currentImageIndex + 1))}
          disabled={currentImageIndex === sortedImages.length - 1}
          className="p-3 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full text-white transition-colors"
          title="Next page (↓)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${((currentImageIndex + 1) / sortedImages.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default MangaReader;
