'use client';

/**
 * ComponentShell — Pure layout primitive for all renderable agent components
 *
 * Provides a consistent visual frame with three slots:
 *   1. Control bar (edit, revert, debug, translate, branch navigation)
 *   2. Content viewport (active view OR debug overlay)
 *   3. View navigation (arrows + position indicator, hidden when viewCount ≤ 1)
 *
 * The consuming component decides what fills each slot; the shell provides the
 * layout contract. No store access — behavior is driven entirely by props.
 *
 * Used by: UserMessage (1 view), AgentMessage (N views), flat-mode standalone
 * components.
 *
 * Replaces: SessionComponentWrapper (deleted).
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Loader2, RotateCcw, Send, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import IconBranch from '@portfolio/ui/icons/IconBranch';
import { TranslateButton } from './TranslateButton';
import { BranchTreeView } from './BranchTreeView';
import { AgentAvatar } from './AgentAvatar';
import { useChatClickAway } from '../hooks/useChatClickAway';
import type { SessionComponentControls, EditingData } from '../types';

// ────────────────────────────────────────────────────────────
// Control bar types
// ────────────────────────────────────────────────────────────

export interface ControlBarConfig {
  /** Which buttons are enabled (from component.controls) */
  controls?: SessionComponentControls;
  /** Currently active eventId for edit/revert (changes per active view in carousel) */
  eventId?: string;
  /** Component ID (for last-component detection) */
  componentId: string;
  /** Role of the component (user/agent) — determines button placement side */
  role: 'user' | 'agent';
  /** Translation source text (for translate button) */
  translationText?: string;
  /** Whether this component is in edit mode */
  isEditMode: boolean;
  /** Whether the current edit is valid for submission */
  isValidForSubmit: boolean;
  /** Callbacks for edit actions */
  onStartEdit?: (data: string | EditingData) => void;
  onSubmitEdit?: () => void;
  onRevert?: (eventId: string) => void;
}

// ────────────────────────────────────────────────────────────
// Branch data
// ────────────────────────────────────────────────────────────

export interface BranchInfo {
  branchSessionId: string;
  timestamp?: Date;
}

export interface ParentBranchInfo {
  parentSessionId: string;
}

// ────────────────────────────────────────────────────────────
// Shell props
// ────────────────────────────────────────────────────────────

export interface ComponentShellProps {
  /** Role for layout direction (user: controls on right, agent: controls on left) */
  role: 'user' | 'agent';
  /** Control bar configuration */
  controlBar: ControlBarConfig;
  /** Number of content views (1 for UserMessage/flat, N for carousel) */
  viewCount: number;
  /** Currently active view index (0-based) */
  activeViewIndex: number;
  /** Navigation callback for carousel arrows */
  onNavigate: (index: number) => void;
  /** Branch child sessions for navigation */
  branches?: BranchInfo[];
  /** Parent session info (if this is a branch) */
  parentBranch?: ParentBranchInfo;
  /** Callbacks for branch navigation */
  onLoadSession?: (sessionId: string) => void;
  onSetPreserveScroll?: (preserve: boolean) => void;
  /** Whether the component is streaming (hides controls during stream) */
  isStreaming?: boolean;
  /** Inline label displayed beside the top-bar controls */
  topBarLabel?: React.ReactNode;
  /** Title displayed centered in top bar for the current view */
  viewTitle?: React.ReactNode;
  /** Status label shown centered in top bar while streaming (e.g. 'Thinking') */
  streamingStatus?: string;
  /** Whether the shell is rendered in expanded full screen mode */
  isExpanded?: boolean;
  /** Expand state toggle callback */
  onToggleExpand?: () => void;
  /** Controls if the expand button should render */
  showExpandButton?: boolean;
  /** Avatar image URL for the expanded agent view */
  avatarImage?: string | null;
  /** Agent display name for the expanded header */
  agentName?: string;
  /** Accent color of the agent */
  agentColor?: string;
  /** Main content (active view or custom) */
  children: React.ReactNode;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const HOVER_BUTTON_CLASS = `
  p-1 rounded-md
  text-slate-400 dark:text-slate-500
  hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
  hover:bg-slate-200/50 dark:hover:bg-slate-700/50
  transition-all duration-200
  cursor-pointer
`;

// ────────────────────────────────────────────────────────────
// ComponentShell
// ────────────────────────────────────────────────────────────

export function ComponentShell({
  role,
  controlBar,
  viewCount,
  activeViewIndex,
  onNavigate,
  branches = [],
  parentBranch,
  onLoadSession,
  onSetPreserveScroll,
  isStreaming = false,
  topBarLabel,
  viewTitle,
  streamingStatus,
  isExpanded = false,
  onToggleExpand,
  showExpandButton = false,
  avatarImage,
  agentName,
  agentColor,
  children,
}: ComponentShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showBranchList, setShowBranchList] = useState(false);

  // ── Escape to cancel edit ───────────────────────────────
  useEffect(() => {
    if (!controlBar.isEditMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Cancel is handled by the consuming component (store.cancelEdit)
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [controlBar.isEditMode]);

  // ── Escape to close expand mode (similar to AgentsHub) ──
  useEffect(() => {
    if (!isExpanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onToggleExpand?.();
      }
    };
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [isExpanded, onToggleExpand]);

  // ── Left/Right Arrow keys for carousel navigation in expand mode ──
  useEffect(() => {
    if (!isExpanded || viewCount <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent carousel slides if focusing an input/editable field
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable ||
         target.hasAttribute('contenteditable'))
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = activeViewIndex - 1;
        if (prevIdx >= 0) {
          onNavigate(prevIdx);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = activeViewIndex + 1;
        if (nextIdx < viewCount) {
          onNavigate(nextIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isExpanded, viewCount, activeViewIndex, onNavigate]);

  // ── Click-away to cancel edit ───────────────────────────
  useChatClickAway(contentRef, {
    mode: 'edit',
    enabled: controlBar.isEditMode,
    onClickAway: () => {
      // Handled by consuming component
    },
    additionalAllowedSelectors: controlBar.isEditMode ? ['[data-edit-allowed]'] : [],
  });

  // ── Show controls only when not streaming ───────────────
  const showControls = !isStreaming;

  // ── Whether the top bar has any content to render ───────
  const hasControls = controlBar.controls && (
    controlBar.controls.edit ||
    controlBar.controls.revert || controlBar.controls.branch ||
    controlBar.controls.translate
  );
  const hasTopBar = showControls && !showBranchList && (
    hasControls || !!parentBranch || branches.length > 0 || viewCount > 1 || controlBar.isEditMode || !!topBarLabel
  );

  // ── Expanded view viewport ──────────────────────────────
  if (isExpanded) {
    return (
      <div
        ref={contentRef}
        className="fixed inset-0 z-40 bg-background flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="relative flex items-center justify-between px-6 py-2 border-b select-none border-border-subtle">
          <div className="flex items-center">
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Back (Esc)"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
            )}
            {(avatarImage || agentName) && (
              <>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                <div className="flex items-center gap-2">
                  <AgentAvatar
                    avatarImage={avatarImage}
                    agentName={agentName}
                    agentColor={agentColor}
                    size="default"
                    className="h-8 w-8"
                  />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {agentName}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Absolute Centered viewTitle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center z-10">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {viewTitle || streamingStatus || ""}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ShellControlBar
              {...controlBar}
              branches={branches}
              parentBranch={parentBranch}
              onLoadSession={onLoadSession}
              onSetPreserveScroll={onSetPreserveScroll}
              onShowBranches={() => setShowBranchList(true)}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              showExpandButton={showExpandButton}
            />
            {viewCount > 1 && (
              <ViewNavigation
                viewCount={viewCount}
                activeViewIndex={activeViewIndex}
                onNavigate={onNavigate}
              />
            )}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-inner px-18 py-6">
          {children}
        </div>
      </div>
    );
  }

  // ── Standard view card ──────────────────────────────────
  return (
    <div
      ref={contentRef}
      className="relative group"
    >
      {/* ── View title — centered ───────────────────── */}
      {isStreaming && streamingStatus ? (
        <div className="absolute top-0 left-6 right-0 z-[9] flex items-center h-8 pointer-events-none">
          <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-cyan-500 dark:text-cyan-400 animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            {streamingStatus}
          </span>
        </div>
      ) : viewTitle ? (
        <div className="absolute top-0 left-0 right-0 z-[9] flex items-center justify-center h-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0">
          <span className="text-[11px] font-medium tracking-wide uppercase text-slate-400 dark:text-slate-500">{viewTitle}</span>
        </div>
      ) : null}

      {/* ── Top bar: controls + navigation ──────────────── */}
      {hasTopBar && (
        <div data-controls className={`absolute top-0 ${role === 'user' ? 'right-0 pr-4' : 'left-0 pl-6'} z-10 flex items-center h-8 gap-1 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
          <ShellControlBar
            {...controlBar}
            branches={branches}
            parentBranch={parentBranch}
            onLoadSession={onLoadSession}
            onSetPreserveScroll={onSetPreserveScroll}
            onShowBranches={() => setShowBranchList(true)}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            showExpandButton={showExpandButton}
          />
          {viewCount > 1 && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0">
              <ViewNavigation
                viewCount={viewCount}
                activeViewIndex={activeViewIndex}
                onNavigate={onNavigate}
              />
            </div>
          )}
          {topBarLabel && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0">
              {topBarLabel}
            </div>
          )}
        </div>
      )}

      {/* ── Content viewport ────────────────────────────── */}
      {showBranchList && branches.length > 0 ? (
        <BranchTreeView
          branches={branches}
          onSelectBranch={(sessionId) => {
            onSetPreserveScroll?.(true);
            onLoadSession?.(sessionId);
          }}
          onClose={() => setShowBranchList(false)}
        />
      ) : (
        children
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ShellControlBar — Renders edit/revert/debug/branch buttons
// ────────────────────────────────────────────────────────────

interface ShellControlBarProps extends ControlBarConfig {
  branches?: BranchInfo[];
  parentBranch?: ParentBranchInfo;
  onLoadSession?: (sessionId: string) => void;
  onSetPreserveScroll?: (preserve: boolean) => void;
  onShowBranches: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showExpandButton?: boolean;
}

function ShellControlBar({
  controls,
  eventId,
  componentId,
  role,
  translationText,
  isEditMode,
  isValidForSubmit,
  onStartEdit,
  onSubmitEdit,
  onRevert,
  branches = [],
  parentBranch,
  onLoadSession,
  onSetPreserveScroll,
  onShowBranches,
  isExpanded = false,
  onToggleExpand,
  showExpandButton = false,
}: ShellControlBarProps) {
  const canShowBranches = controls?.branch && branches.length > 0;
  const canShowEdit = controls?.edit;
  const canShowRevert = controls?.revert;
  const canShowTranslate = controls?.translate;

  // ── Edit mode: show only submit button ──────────────────
  if (isEditMode) {
    return (
      <div data-edit-allowed className="flex items-center gap-1">
        <button
          data-edit-allowed
          onClick={onSubmitEdit}
          disabled={!isValidForSubmit}
          className={`
            px-1 rounded scale-[1.2]
            transition-all duration-200
            ${isValidForSubmit
              ? 'text-cyan-400 dark:text-cyan-400 hover:text-cyan-300 hover:scale-[1.3] dark:hover:text-cyan-300 hover:bg-cyan-500/5 dark:hover:bg-cyan-500/5'
              : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }
          `}
          title={isValidForSubmit ? 'Submit Edit' : 'Fix validation errors to submit'}
        >
          <Send size="14" />
        </button>
      </div>
    );
  }

  // ── Normal mode: all buttons ────────────────────────────
  const reverseClass = role === 'user' ? 'flex-row-reverse' : '';
  return (
    <div className={`flex items-center gap-1 ${reverseClass}`}>
      {/* Always-visible branch buttons */}
      {canShowBranches && (
        <button
          onClick={() => {
            if (branches.length === 1) {
              onSetPreserveScroll?.(true);
              onLoadSession?.(branches[0].branchSessionId);
            } else {
              onShowBranches();
            }
          }}
          className="p-1 rounded-md hover:scale-110 transition-all duration-200 cursor-pointer rotate-180 text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/20"
          title={branches.length === 1 ? 'Switch to branch' : `Show ${branches.length} branches`}
        >
          <IconBranch size="12" />
        </button>
      )}

      {parentBranch && (
        <button
          onClick={() => {
            onSetPreserveScroll?.(true);
            onLoadSession?.(parentBranch.parentSessionId);
          }}
          className="p-1 rounded-md hover:scale-110 transition-all duration-200 cursor-pointer text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 hover:bg-orange-100/50 dark:hover:bg-orange-900/20"
          title="Go to parent session"
        >
          <IconBranch size="12" />
        </button>
      )}

      {/* Action buttons — always visible when expanded, hover-only otherwise */}
      <div className={`flex items-center gap-1 ${reverseClass} ${
        isExpanded 
          ? 'opacity-100' 
          : 'opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0'
      }`}>
        {canShowEdit && onStartEdit && (
          <button
            data-edit-allowed
            onClick={() => onStartEdit(translationText || '')}
            className={HOVER_BUTTON_CLASS}
            title="Edit"
          >
            <Edit2 size="12" />
          </button>
        )}

        {canShowRevert && onRevert && eventId && (
          <button
            onClick={() => onRevert(eventId)}
            className={HOVER_BUTTON_CLASS}
            title="Revert to this point"
          >
            <RotateCcw size="12" />
          </button>
        )}

        {canShowTranslate && translationText && (
          <TranslateButton
            componentId={componentId}
            originalText={translationText}
          />
        )}

        {showExpandButton && onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className={HOVER_BUTTON_CLASS}
            title={isExpanded ? "Collapse View" : "Expand View"}
          >
            {isExpanded ? <Minimize2 size="12" /> : <Maximize2 size="12" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ViewNavigation — Carousel arrows + position indicator
// ────────────────────────────────────────────────────────────

interface ViewNavigationProps {
  viewCount: number;
  activeViewIndex: number;
  onNavigate: (index: number) => void;
}

function ViewNavigation({ viewCount, activeViewIndex, onNavigate }: ViewNavigationProps) {
  const canGoBack = activeViewIndex > 0;
  const canGoForward = activeViewIndex < viewCount - 1;

  const NAV_BUTTON_ENABLED = `
    p-1 rounded-md
    text-slate-400 dark:text-slate-500
    hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
    hover:bg-slate-200/50 dark:hover:bg-slate-700/50
    transition-all duration-200
    cursor-pointer
  `;

  const NAV_BUTTON_DISABLED = `
    p-1 rounded-md
    text-slate-300 dark:text-slate-700
    cursor-default
  `;

  return (
    <div className="flex items-center gap-1 select-none flex-shrink-0">
      <button
        onClick={() => canGoBack && onNavigate(activeViewIndex - 1)}
        disabled={!canGoBack}
        className={canGoBack ? NAV_BUTTON_ENABLED : NAV_BUTTON_DISABLED}
        aria-label="Previous view"
      >
        <ChevronLeft size={12} />
      </button>

      <span className="text-[11px] tabular-nums min-w-[3ch] text-center text-slate-400 dark:text-slate-500">
        {activeViewIndex + 1}/{viewCount}
      </span>

      <button
        onClick={() => canGoForward && onNavigate(activeViewIndex + 1)}
        disabled={!canGoForward}
        className={canGoForward ? NAV_BUTTON_ENABLED : NAV_BUTTON_DISABLED}
        aria-label="Next view"
      >
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
