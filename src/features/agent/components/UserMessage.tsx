'use client';

/**
 * UserMessage — Renders user-role messages in the chat interface
 *
 * Extracted from MessageBubble (user path only). Uses ComponentShell for
 * controls, debug overlay, and branch navigation. Single-view (no carousel).
 *
 * Features:
 *   - Right-aligned gradient bubble
 *   - MentionHighlightedText for @mentions
 *   - Encoded images flex layout
 *   - Library items grid (LightAssetGrid)
 *   - Inline contentEditable editing
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { MentionHighlightedText } from './MentionHighlightedText';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { BorderBeam } from '@/features/shared/components/shadcn/border-beam';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionBranching } from '../hooks/useAgentSessionBranching';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import { parseLibraryPaths } from '../utils/libraryMentionParser';
import { LightAssetGrid, useLibraryItemsByPaths, type LightAssetItem } from '@/features/library';
import { DebugView } from './DebugView';
import type { AgentSessionComponent, AgentSessionEvent, EditingData } from '../types';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface UserMessageProps {
  component: AgentSessionComponent;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const UserMessage = React.memo(function UserMessage({ component }: UserMessageProps) {
  const { id, data, isStreaming, controls } = component;
  const sessionEvents = data.sessionEvents;

  // ── Store selectors ─────────────────────────────────────
  const editingEventId = useAgentStore((s) => s.editingEventId);
  const isEditMode = editingEventId === id;
  const editingData = useAgentStore((s) => s.editingEventId === id ? s.editingData : undefined);
  const startEdit = useAgentStore((s) => s.startEdit);
  const updateEditingData = useAgentStore((s) => s.updateEditingData);
  const cancelEdit = useAgentStore((s) => s.cancelEdit);
  const setPreserveScrollOnSessionChange = useAgentStore((s) => s.setPreserveScrollOnSessionChange);

  // ── Branching ───────────────────────────────────────────
  const { submitEdit, revertToComponent } = useAgentSessionBranching();
  const { loadAgentSession } = useAgentSessionLifecycle();

  // ── View state (carousel: debug at index 0, content at index 1) ──
  const hasDebugView = !!controls?.debug;
  const itemOffset = hasDebugView ? 1 : 0;
  const [activeViewIndex, setActiveViewIndex] = useState(itemOffset);
  const totalViews = 1 + (hasDebugView ? 1 : 0);
  const clampedIndex = Math.min(activeViewIndex, Math.max(totalViews - 1, 0));
  const isShowingDebug = hasDebugView && clampedIndex === 0;
  const heightMode = isShowingDebug ? 'fixed' : 'auto';

  // ── Branch data from sessionEvents ──────────────────────
  const branches: BranchInfo[] = useMemo(() => {
    return (sessionEvents || [])
      .filter((e): e is Extract<AgentSessionEvent, { type: 'branch' }> =>
        e.type === 'branch' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId as string,
        timestamp: e.timestamp,
      }));
  }, [sessionEvents]);

  const parentBranch: ParentBranchInfo | undefined = useMemo(() => {
    const found = (sessionEvents || []).find((e): e is Extract<AgentSessionEvent, { type: 'branch' }> =>
      e.type === 'branch' && !!e.data.parentSessionId
    );
    return found ? { parentSessionId: found.data.parentSessionId as string } : undefined;
  }, [sessionEvents]);

  // ── Content ─────────────────────────────────────────────
  const content = data.message || '';
  const editingMessage = editingData?.message || '';
  const editingElRef = useRef<HTMLDivElement | null>(null);

  const encodedImages = data.encodedImages;
  const hasImages = encodedImages && encodedImages.length > 0;

  // Library item IDs from asset picker
  const libraryItemIds = data.libraryItemIds;

  // Parse @library/path patterns — stabilize ref
  const prevPathsRef = useRef<string[]>([]);
  const libraryPaths = useMemo(() => {
    if (!content) { prevPathsRef.current = []; return prevPathsRef.current; }
    const parsed = parseLibraryPaths(content);
    const prev = prevPathsRef.current;
    if (parsed.length === prev.length && parsed.every((p, i) => p === prev[i])) return prev;
    prevPathsRef.current = parsed;
    return parsed;
  }, [content]);

  const hasLibraryItems = (libraryItemIds && libraryItemIds.length > 0) || libraryPaths.length > 0;
  const expectedItemCount = (libraryPaths?.length || 0) + (libraryItemIds?.length || 0);

  const { items: libraryItems, isLoading: libraryLoading, error: libraryError } = useLibraryItemsByPaths(
    libraryPaths.length > 0 ? libraryPaths : undefined,
    libraryItemIds
  );

  // ── Library item interactions ───────────────────────────
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handlePathClick = useCallback((path: string) => {
    setFocusedPath(path);
    gridContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setFocusedPath(null), 2000);
  }, []);

  const handleItemClick = useCallback((item: LightAssetItem) => {
    setFocusedPath(item.path);
  }, []);

  const handleClearFocus = useCallback(() => setFocusedPath(null), []);

  const handleViewInLibrary = useCallback((item: LightAssetItem) => {
    window.open(`/library?path=${encodeURIComponent(item.path)}`, '_blank');
  }, []);

  // ── Edit mode setup ─────────────────────────────────────
  useEffect(() => {
    if (isEditMode && editingElRef.current) {
      const el = editingElRef.current;
      if (el.textContent !== editingMessage) {
        el.textContent = editingMessage;
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

  // ── Escape to cancel edit ───────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditMode, cancelEdit]);

  // ── Collapse listener (agent:collapseAll) ───────────────
  useEffect(() => {
    const onCollapse = () => setActiveViewIndex(itemOffset);
    window.addEventListener('agent:collapseAll', onCollapse);
    return () => window.removeEventListener('agent:collapseAll', onCollapse);
  }, [itemOffset]);

  // ── Edit callbacks ──────────────────────────────────────
  const handleStartEdit = useCallback(
    () => startEdit(id, content),
    [startEdit, id, content],
  );

  const handleSubmitEdit = useCallback(() => {
    const store = useAgentStore.getState();
    if (store.editingEventId && store.editingData) {
      submitEdit(store.editingEventId, store.editingData);
    }
  }, [submitEdit]);

  const handleRevert = useCallback(
    (eventId: string) => revertToComponent(eventId),
    [revertToComponent],
  );

  // ── Determine if content is present ─────────────────────
  const hasContent = content?.trim() || hasImages || hasLibraryItems || isEditMode;

  // ── Render content ──────────────────────────────────────
  const contentRenderer = isEditMode ? (
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={() => { /* keep typing local to DOM */ }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertLineBreak');
          } else {
            e.preventDefault();
            const newText = editingElRef.current?.textContent || '';
            updateEditingData({ message: newText });
            handleSubmitEdit();
          }
        }
      }}
      onBlur={() => {
        const newText = editingElRef.current?.textContent || '';
        updateEditingData({ message: newText });
      }}
      dir="auto"
      className="w-full overflow-hidden bg-transparent border-none outline-none font-sans text-sm leading-relaxed whitespace-pre-wrap break-all text-white empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
      data-placeholder="Edit message..."
      ref={editingElRef}
    />
  ) : (
    <pre dir="auto" className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words m-0">
      <MentionHighlightedText content={content} onPathClick={handlePathClick} isDark />
    </pre>
  );

  // ── Build control bar config ────────────────────────────
  const controlBarConfig = useMemo(() => ({
    controls,
    eventId: id,
    componentId: id,
    role: 'user' as const,
    translationText: undefined,
    isEditMode,
    isValidForSubmit: true,
    onStartEdit: handleStartEdit,
    onSubmitEdit: handleSubmitEdit,
    onRevert: handleRevert,
  }), [controls, id, isEditMode, handleStartEdit, handleSubmitEdit, handleRevert]);

  return (
    <div className="flex flex-col items-end">
      {hasContent && (
        <div
          className="session-component rounded-2xl relative min-w-[160px] max-w-[56%] bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] rounded-tr-md"
        >
          {isEditMode && (
            <BorderBeam colorFrom="#06b6d4" colorTo="#22d3ee" borderWidth={3} pixelsPerSecond={500} />
          )}

          <ComponentShell
            role="user"
            controlBar={controlBarConfig}
            viewCount={totalViews}
            activeViewIndex={clampedIndex}
            onNavigate={setActiveViewIndex}
            branches={branches}
            parentBranch={parentBranch}
            heightMode={heightMode}
            onLoadSession={loadAgentSession}
            onSetPreserveScroll={setPreserveScrollOnSessionChange}
            isStreaming={isStreaming ?? false}
            viewTitle={isShowingDebug ? 'Agent Session Events' : undefined}
          >
            {isShowingDebug ? (
                <DebugView sessionEvents={sessionEvents} />
            ) : (
            <>
              {/* Text content */}
              {(content?.trim() || isEditMode) && <div>{contentRenderer}</div>}

              {/* Encoded images */}
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

              {/* Library items */}
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
                    isUserMessage
                  />
                </div>
              )}
            </>
            )}
          </ComponentShell>
        </div>
      )}
    </div>
  );
});
