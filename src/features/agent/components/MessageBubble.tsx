/**
 * MessageBubble - Pure message renderer for user and agent messages
 * 
 * Responsibilities:
 * - Render user messages (right-aligned, gradient bubble)
 * - Render agent messages (left-aligned, content only)
 * - Optimized with React.memo for performance
 * 
 * Note: Thoughts are rendered separately via agent-thoughts component type
 */

import React, { useCallback, useRef, useState } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { MentionHighlightedText } from './MentionHighlightedText';
import { useControls } from '../contexts/SessionComponentContext';
import { BorderBeam } from '@/features/shared/components/shadcn/border-beam';
import { JobActionBar } from '../core/tools/agent-job/components/JobActionBar';
import { useAgentStore } from '../stores/useAgentStore';
import { parseLibraryPaths } from '../utils/libraryMentionParser';
import { LightAssetGrid, useLibraryItemsByPaths, type LightAssetItem } from '@/features/library';

export const MessageBubble = React.memo(function MessageBubble() {
  // Get all data from context
  const {
    componentId: id,
    componentRole,
    data,
    isEditMode,
    editingData,
    onUpdateEditingData,
    onSubmitEdit,
  } = useControls();
  
  // Translation state
  const activeLanguage = useAgentStore((s) => s.activeTranslations[id]);
  const cachedTranslation = useAgentStore((s) => 
    activeLanguage ? s.translationCache[id]?.[activeLanguage] : undefined
  );
  
  const originalContent = data.message;
  const content = activeLanguage && cachedTranslation ? cachedTranslation : originalContent;
  const role = componentRole || 'agent';
  const isTranslated = !!activeLanguage && !!cachedTranslation;
  const editingMessage = editingData?.message || '';
  const isUser = role === 'user';
  const editingElRef = React.useRef<HTMLDivElement | null>(null);
  
  // Extract encoded images from data
  const encodedImages = data.encodedImages as Array<{ mimeType: string; data: string }> | undefined;
  const hasImages = encodedImages && encodedImages.length > 0;
  
  // Extract library item IDs (for user messages from asset picker)
  const libraryItemIds = data.libraryItemIds as string[] | undefined;
  
  // Parse @library/path patterns from content — stabilize array reference
  // to prevent useEffect in useLibraryItemsByPaths from re-firing when the
  // parsed paths haven't actually changed (common during streaming)
  const prevPathsRef = useRef<string[]>([]);
  const libraryPaths = React.useMemo(() => {
    if (!content) {
      prevPathsRef.current = [];
      return prevPathsRef.current;
    }
    const parsed = parseLibraryPaths(content);
    // Return previous reference if paths are identical
    const prev = prevPathsRef.current;
    if (
      parsed.length === prev.length &&
      parsed.every((p, i) => p === prev[i])
    ) {
      return prev;
    }
    prevPathsRef.current = parsed;
    return parsed;
  }, [content]);
  
  const hasLibraryItems = (libraryItemIds && libraryItemIds.length > 0) || libraryPaths.length > 0;
  
  // Expected item count for skeleton placeholders during loading
  const expectedItemCount = (libraryPaths?.length || 0) + (libraryItemIds?.length || 0);

  // Fetch library items
  const { items: libraryItems, isLoading: libraryLoading, error: libraryError } = useLibraryItemsByPaths(
    libraryPaths.length > 0 ? libraryPaths : undefined,
    libraryItemIds
  );
  
  // Track focused path (when user clicks a library mention in text)
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const gridContainerRef = React.useRef<HTMLDivElement>(null);
  
  const hasContent = content?.trim() || hasImages || hasLibraryItems || isEditMode;
  
  // Handle click on library path in text - focus the item in grid and scroll into view
  const handlePathClick = useCallback((path: string) => {
    setFocusedPath(path);
    
    // Scroll grid into view
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Clear focus after a short delay
    setTimeout(() => setFocusedPath(null), 2000);
  }, []);
  
  // Handle click on item in grid
  const handleItemClick = useCallback((item: LightAssetItem) => {
    setFocusedPath(item.path);
  }, []);
  
  // Clear focus (called on Escape via global event)
  const handleClearFocus = useCallback(() => {
    setFocusedPath(null);
  }, []);
  
  // Handle "View in Library" from context menu - opens library page at item's path
  const handleViewInLibrary = useCallback((item: LightAssetItem) => {
    const url = `/library?path=${encodeURIComponent(item.path)}`;
    window.open(url, '_blank');
  }, []);

  // Initialize editor content and caret when entering edit mode or when source changes externally
  React.useEffect(() => {
    if (isEditMode && editingElRef.current) {
      const el = editingElRef.current;
      if (el.textContent !== editingMessage) {
        el.textContent = editingMessage;
        // Place cursor at end on initial mount
        if (el.firstChild) {
          const range = document.createRange();
          const selection = window.getSelection();
          range.setStart(el.firstChild, el.textContent?.length || 0);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        el.focus();
      }
    }
  }, [isEditMode, editingMessage]);

  // Determine content type at the core
  const contentRenderer = isEditMode ? (
    // Edit mode: contenteditable div for dynamic width
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={(_e) => {
        // Keep typing local to the DOM node to avoid re-renders while spamming input
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (e.shiftKey) {
            // Shift+Enter: insert new line
            e.preventDefault();
            document.execCommand('insertLineBreak');
          } else {
            // Enter: submit edit
            e.preventDefault();
            const newText = editingElRef.current?.textContent || '';
            onUpdateEditingData({ message: newText });
            onSubmitEdit?.();
          }
        }
      }}
      onBlur={() => {
        const newText = editingElRef.current?.textContent || '';
        onUpdateEditingData({ message: newText });
      }}
      dir="auto"
      className={`
        w-full overflow-hidden bg-transparent border-none outline-none
        font-sans text-sm leading-relaxed whitespace-pre-wrap break-all
        ${isUser ? 'text-white' : 'text-foreground'}
        empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground
      `}
      data-placeholder="Edit message..."
      ref={editingElRef}
    />
  ) : isUser ? (
    // User message: plain text with mention highlighting
    <pre dir="auto" className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words m-0">
      <MentionHighlightedText 
        content={content || ''} 
        onPathClick={handlePathClick}
        isDark={true}
      />
    </pre>
  ) : (
    // Agent message: markdown with library path highlighting
    <MarkdownContent content={content || ''} onPathClick={handlePathClick} />
  );


  // Unified UI structure
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {hasContent && (
        <div
          className={`
            session-component px-4 py-3 rounded-2xl relative
            ${
              isUser
                ? 'max-w-[56%] bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] rounded-tr-md'
                : 'max-w-[76%] bg-white dark:bg-surface-1 border border-slate-200 dark:border-border-subtle text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] rounded-tl-md'
            }
          `}
        >
          {isEditMode && <BorderBeam colorFrom="#06b6d4" colorTo="#22d3ee" borderWidth={3} pixelsPerSecond={500} />}
          
          {/* Text Content */}
          {(content?.trim() || isEditMode) && (
            <div>
              {contentRenderer}
            </div>
          )}
          
          {/* Image Flex Layout (max 20 shown) */}
          {hasImages && (
            <div className={`flex flex-wrap gap-1.5 ${content?.trim() ? 'mt-2' : ''}`}>
              {encodedImages!.slice(0, 20).map((img, index) => (
                <a
                  key={index}
                  href={`data:${img.mimeType};base64,${img.data}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md hover:opacity-90 transition-opacity"
                >
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={`Attached image ${index + 1}`}
                    className="h-16 w-16 object-cover"
                  />
                </a>
              ))}
              {encodedImages!.length > 20 && (
                <div className="flex items-center justify-center h-16 px-3 text-sm text-muted-foreground">
                  +{encodedImages!.length - 20} more
                </div>
              )}
            </div>
          )}
          
          {/* Library Items Preview */}
          {hasLibraryItems && (
            <div ref={gridContainerRef} className="mt-6">
              <LightAssetGrid
                items={libraryItems}
                isLoading={libraryLoading}
                expectedCount={expectedItemCount}
                error={libraryError}
                maxVisible={17}
                focusedPath={focusedPath}
                onItemClick={handleItemClick}
                onViewInLibrary={handleViewInLibrary}
                onClearFocus={handleClearFocus}
                isUserMessage={isUser}
              />
            </div>
          )}
          
          {/* Job action buttons (floating, appears on last component for job) */}
          <JobActionBar />
        </div>
      )}
    </div>
  );
});
