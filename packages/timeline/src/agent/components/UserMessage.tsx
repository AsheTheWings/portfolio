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
 *   - Mailbox: client/developer view mode rendering for <client_user> and <developer_user> tagged content
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { MentionHighlightedText } from './MentionHighlightedText';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { BorderBeam } from '@portfolio/ui/components/shadcn/border-beam';
import { useAgentStore } from '../stores/useAgentStore';
import { useSessionBranching } from '../hooks/useSessionBranching';
import { useSessionLifecycle } from '../hooks/useSessionLifecycle';
import { parseLibraryPaths } from '@portfolio/ui/utils/libraryMentionParser';
import { LightAssetGrid, useLibraryItemsByPaths, type LightAssetItem } from '@portfolio/timeline/library';
import { DebugView } from './DebugView';
import { parseTaggedContent } from '../utils/user-tags';
import type { SessionComponent, SessionEvent } from '../types';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface UserMessageProps {
  component: SessionComponent;
}

/**
 * Mailbox composition styling:
 *   - In `developer` userMode the outer bubble flips to cyan (developer
 *     authored the turn) and the embedded `<client_user>` section inverts to
 *     a neutral slate look so the contrast still reads.
 *   - In `client` userMode the bubble keeps the regular slate gradient
 *     and only the client-message content is rendered.
 * Derived from the store — no prop drilling.
 */

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
  const userMode = useAgentStore((s) => s.userMode);

  // ── Branching ───────────────────────────────────────────
  const { submitEdit, revertToComponent } = useSessionBranching();
  const { loadSession } = useSessionLifecycle();

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
      .filter((e): e is Extract<SessionEvent, { type: 'session_branched' }> =>
        e.type === 'session_branched' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId as string,
        timestamp: e.timestamp,
      }));
  }, [sessionEvents]);

  const parentBranch: ParentBranchInfo | undefined = useMemo(() => {
    const found = (sessionEvents || []).find((e): e is Extract<SessionEvent, { type: 'session_branched' }> =>
      e.type === 'session_branched' && !!e.data.parentSessionId
    );
    return found ? { parentSessionId: found.data.parentSessionId as string } : undefined;
  }, [sessionEvents]);

  // ── Content ─────────────────────────────────────────────
  const rawContent = data.message || '';
  const { developerText, userText } = useMemo(() => parseTaggedContent(rawContent), [rawContent]);
  const isUserOnlyTaggedMessage = userText !== null && developerText === null;

  // In client view mode, only show <client_user> content if present.
  // In developer view mode, client-only tagged messages render identically to
  // client mode; composite messages still render with developer/client sections.
  const content = (userText !== null && (userMode === 'client' || isUserOnlyTaggedMessage))
    ? userText
    : rawContent;

  // Skip rendering entirely if in client mode and there's no client-tagged content
  const isClientOnlyMessage = userMode === 'client' && userText === null && !isEditMode;

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

  // ── Build control bar config ────────────────────────────
  // Computed before the early-return guard below: hook count must stay stable
  // across renders (the `isClientOnlyMessage` branch flips on userMode toggle).
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

  // In client mode, skip messages that have no client content (developer-only messages)
  if (isClientOnlyMessage && !hasImages && !hasLibraryItems) return null;

  // ── Render content ──────────────────────────────────────
  // In user view mode with client content: render full message with highlighted client section
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
  ) : userMode === 'developer' && userText !== null && developerText !== null ? (
    // Developer view mode for composite turns: developer text on top,
    // highlighted user section below. User-only turns intentionally fall
    // through to the normal user bubble renderer.
    <div className="flex flex-col gap-1.5">
      <pre dir="auto" className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words m-0">
        <MentionHighlightedText content={developerText} onPathClick={handlePathClick} isDark />
      </pre>
      <div className="rounded-lg bg-slate-700/60 border border-slate-400/30 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200/80 block mb-0.5">
          user
        </span>
        <pre dir="auto" className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words m-0 text-white">
          {userText}
        </pre>
      </div>
    </div>
  ) : (
    <pre dir="auto" className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words m-0">
      <MentionHighlightedText content={content} onPathClick={handlePathClick} isDark />
    </pre>
  );

  return (
    <div className="flex flex-col items-end">
      {hasContent && (
        <div
          className={`session-component rounded-2xl relative min-w-[160px] max-w-[56%] text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] rounded-tr-md ${
            userMode === 'developer' && !isUserOnlyTaggedMessage
              ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 dark:from-cyan-600 dark:to-cyan-800'
              : 'bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700'
          }`}
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
            onLoadSession={loadSession}
            onSetPreserveScroll={setPreserveScrollOnSessionChange}
            isStreaming={isStreaming ?? false}
            viewTitle={isShowingDebug ? 'Agent Session Events' : undefined}
          >
            {isShowingDebug ? (
              <div className="px-4 pt-8 pb-4 h-[240px] overflow-auto scrollbar-inner">
                <DebugView sessionEvents={sessionEvents} />
              </div>
            ) : (
              <div className="px-4 py-8">
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
              </div>
            )}
          </ComponentShell>
        </div>
      )}
    </div>
  );
});
