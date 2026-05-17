'use client';

/**
 * MentionHighlightedText - Renders text with library references highlighted
 * Format: @library/path
 * Clicking on a library reference triggers the onPathClick callback
 */

import React, { useCallback } from 'react';
import { segmentContent } from '@portfolio/ui/utils/libraryMentionParser';

interface MentionHighlightedTextProps {
  content: string;
  className?: string;
  /** Callback when a library path is clicked */
  onPathClick?: (path: string) => void;
  /** Whether in a dark context (user message) */
  isDark?: boolean;
}

export function MentionHighlightedText({ 
  content, 
  className = '',
  onPathClick,
  isDark = false,
}: MentionHighlightedTextProps) {
  const handleClick = useCallback((path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPathClick?.(path);
  }, [onPathClick]);

  if (!content) return null;
  
  const segments = segmentContent(content);
  
  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'library-path') {
          return (
            <button
              key={index}
              onClick={(e) => handleClick(segment.path, e)}
              className={`
                inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-sm font-medium text-[0.85em]
                transition-all cursor-pointer
                ${isDark 
                  ? 'bg-cyan-400/25 text-cyan-100 hover:bg-cyan-400/40 border border-cyan-400/50' 
                  : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/50'
                }
              `}
              title={`Click to focus: ${segment.path}`}
            >
              {segment.value}
            </button>
          );
        }
        return <React.Fragment key={index}>{segment.value}</React.Fragment>;
      })}
    </span>
  );
}
