'use client';

/**
 * LibraryToolsBar - Floating toolbar for library actions
 * Positioned on the right edge, vertically centered
 */

import { Search } from 'lucide-react';

interface LibraryToolsBarProps {
  onShowUploader: () => void;
  onOpenSearch: () => void;
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

export function LibraryToolsBar({ onShowUploader, onOpenSearch }: LibraryToolsBarProps) {
  const handleAddClick = () => {
    onShowUploader();
  };

  return (
    <>

      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {/* Add Asset Button */}
        <button
          onClick={handleAddClick}
          className="
            w-12 h-12 rounded-full
            bg-surface-1 border border-border-subtle
            shadow-depth-md hover:shadow-depth-lg
            text-foreground hover:text-foreground
            transition-all duration-200
            flex items-center justify-center
            group
            active:scale-95
          "
          title="Add Asset"
        >
          <div className="transform group-hover:rotate-90 transition-transform duration-200">
            <PlusIcon className="w-5 h-5" />
          </div>
        </button>

        {/* Search Button */}
        <button
          onClick={onOpenSearch}
          className="
            w-12 h-12 rounded-full
            bg-surface-1 border border-border-subtle
            shadow-depth-md hover:shadow-depth-lg
            text-foreground hover:text-foreground
            transition-all duration-200
            flex items-center justify-center
            group
            active:scale-95
          "
          title="Search (⌘K)"
        >
          <Search className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
        </button>
      </div>
    </>
  );
}

export default LibraryToolsBar;
