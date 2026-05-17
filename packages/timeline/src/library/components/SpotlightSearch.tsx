'use client';

/**
 * SpotlightSearch - Floating glassmorphism search bar
 * Results appear in the main grid
 */

import { useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SpotlightSearchProps {
  isOpen: boolean;
  query: string;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

export function SpotlightSearch({
  isOpen,
  query,
  isSearching,
  onQueryChange,
  onClose,
}: SpotlightSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Close only if clicking on the backdrop, not the search box
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      {/* Glassmorphism container */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-white/10 to-transparent dark:from-white/50 dark:via-white/30 dark:to-white/20 p-[1.5px]">
          <div className="w-full h-full rounded-full bg-white/30 dark:bg-neutral-900/40" />
        </div>
        
        {/* Glass layer with blur */}
        <div 
          className="
            relative
            backdrop-blur-xl backdrop-saturate-150
            bg-gradient-to-br from-white/40 via-white/30 to-white/20
            dark:from-neutral-900/50 dark:via-neutral-800/40 dark:to-neutral-800/30
            shadow-[0_8px_32px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.4)]
            dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
          "
        >
          {/* Inner content */}
          <div className="flex items-center gap-4 p-6">
            {/* Search icon with subtle glow */}
            <div className="relative">
              {isSearching ? (
                <Loader2 className="w-6 h-6 text-neutral-500 dark:text-neutral-400 animate-spin" />
              ) : (
                <Search className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
              )}
            </div>
            
            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search folders and files..."
              className="
                flex-1 bg-transparent outline-none
                text-lg font-medium
                text-neutral-800 dark:text-neutral-100
                placeholder:text-neutral-400 dark:placeholder:text-neutral-500
              "
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            
            {/* Clear button */}
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="
                  p-2 rounded-xl
                  bg-neutral-200/50 dark:bg-white/10
                  hover:bg-neutral-300/50 dark:hover:bg-white/20
                  transition-colors duration-150
                "
              >
                <X className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpotlightSearch;
