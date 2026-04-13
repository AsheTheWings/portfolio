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
 * Replaces: AgentSessionComponentWrapper (deleted).
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Edit2, RotateCcw, Send } from 'lucide-react';
import IconFocusCenter from '@/features/shared/icons/IconFocusCenter';
import IconBranch from '@/features/shared/icons/IconBranch';
import { TranslateButton } from './TranslateButton';
import { DebugView } from './DebugView';
import { BranchTreeView } from './BranchTreeView';
import { useChatClickAway } from '../hooks/useChatClickAway';
import type { AgentSessionEvent, AgentSessionComponentControls, EditingData } from '../types';

// ────────────────────────────────────────────────────────────
// Control bar types
// ────────────────────────────────────────────────────────────

export interface ControlBarConfig {
  /** Which buttons are enabled (from component.controls) */
  controls?: AgentSessionComponentControls;
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
  /** Session events for debug inspector */
  sessionEvents?: AgentSessionEvent[];
  /** Whether debug view is toggled on */
  isDebugView: boolean;
  /** Callback to toggle debug overlay */
  onToggleDebug: () => void;
  /** Height mode — 'fixed' (~300px, scrollable viewport) | 'auto' (growable) */
  heightMode?: 'fixed' | 'auto';
  /** Callbacks for branch navigation */
  onLoadSession?: (sessionId: string) => void;
  onSetPreserveScroll?: (preserve: boolean) => void;
  /** Whether the component is streaming (hides controls during stream) */
  isStreaming?: boolean;
  /** Main content (active view or custom) */
  children: React.ReactNode;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const FIXED_HEIGHT = 300; // px for thoughts/tool-call views

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
  sessionEvents,
  isDebugView,
  onToggleDebug,
  heightMode = 'auto',
  onLoadSession,
  onSetPreserveScroll,
  isStreaming = false,
  children,
}: ComponentShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showBranchList, setShowBranchList] = useState(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // ── Shift key tracking ──────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

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

  // ── Click-away to cancel edit ───────────────────────────
  useChatClickAway(contentRef, {
    mode: 'edit',
    enabled: controlBar.isEditMode,
    onClickAway: () => {
      // Handled by consuming component
    },
    additionalAllowedSelectors: controlBar.isEditMode ? ['[data-edit-allowed]'] : [],
  });

  // ── Shift+click for debug toggle ────────────────────────
  const handleShiftClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-controls]')) return;
    if (e.shiftKey && sessionEvents && sessionEvents.length > 0 && !controlBar.isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleDebug();
    }
  }, [sessionEvents, controlBar.isEditMode, onToggleDebug]);

  // ── Cursor ──────────────────────────────────────────────
  const cursorClass = isShiftHeld && sessionEvents && sessionEvents.length > 0 && !controlBar.isEditMode
    ? 'cursor-pointer' : '';

  // ── Show controls only when not streaming ───────────────
  const showControls = !isStreaming;

  return (
    <div
      ref={contentRef}
      className={`relative group ${cursorClass}`}
      onClick={handleShiftClick}
    >
      {/* ── Control bar ─────────────────────────────────── */}
      {showControls && !isDebugView && (
        <div
          data-controls
          className={`absolute z-99 w-[100px] ${
            role === 'user' ? 'right-[-6.8rem]' : 'left-[-6.8rem]'
          }`}
        >
          <ShellControlBar
            {...controlBar}
            branches={branches}
            parentBranch={parentBranch}
            onLoadSession={onLoadSession}
            onSetPreserveScroll={onSetPreserveScroll}
            onToggleDebug={onToggleDebug}
            onShowBranches={() => setShowBranchList(true)}
          />
        </div>
      )}

      {/* ── Content viewport ────────────────────────────── */}
      {isDebugView ? (
        <DebugView
          sessionEvents={sessionEvents}
          onClose={onToggleDebug}
        />
      ) : showBranchList && branches.length > 0 ? (
        <BranchTreeView
          branches={branches}
          onSelectBranch={(sessionId) => {
            onSetPreserveScroll?.(true);
            onLoadSession?.(sessionId);
          }}
          onClose={() => setShowBranchList(false)}
        />
      ) : (
        <div
          className={heightMode === 'fixed' ? 'overflow-y-auto scrollbar-hide' : ''}
          style={heightMode === 'fixed' ? { maxHeight: FIXED_HEIGHT } : undefined}
        >
          {children}
        </div>
      )}

      {/* ── View navigation (carousel arrows) ───────────── */}
      {viewCount > 1 && !isDebugView && !showBranchList && (
        <ViewNavigation
          viewCount={viewCount}
          activeViewIndex={activeViewIndex}
          onNavigate={onNavigate}
        />
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
  onToggleDebug: () => void;
  onShowBranches: () => void;
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
  onToggleDebug,
  onShowBranches,
}: ShellControlBarProps) {
  const canShowDebug = controls?.debug;
  const canShowBranches = controls?.branch && branches.length > 0;
  const canShowEdit = controls?.edit;
  const canShowRevert = controls?.revert;
  const canShowTranslate = controls?.translate;
  const hasAnyControls = canShowDebug || canShowEdit || canShowRevert || canShowBranches || canShowTranslate || !!parentBranch;

  if (!hasAnyControls) return null;

  const isAgentRole = role !== 'user';
  const reverseClass = isAgentRole ? 'flex-row-reverse' : '';

  // ── Edit mode: show only submit button ──────────────────
  if (isEditMode) {
    return (
      <div data-edit-allowed className={`flex items-center gap-1 ${reverseClass}`}>
        <button
          data-edit-allowed
          onClick={onSubmitEdit}
          disabled={!isValidForSubmit}
          className={`
            mx-2 px-1 rounded scale-[1.2]
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
  return (
    <div className={`flex items-center gap-1 ${reverseClass}`}>
      {/* Always-visible buttons (nearest to content) */}
      <div className={`flex items-center gap-1 ${reverseClass}`}>
        {/* Branch child button (purple, rotated) */}
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
            className="
              p-1 rounded-md
              text-purple-500 dark:text-purple-400
              hover:text-purple-600 hover:scale-110 dark:hover:text-purple-300
              hover:bg-purple-100/50 dark:hover:bg-purple-900/20
              transition-all duration-200 opacity-100 cursor-pointer rotate-180
            "
            title={branches.length === 1 ? 'Switch to branch' : `Show ${branches.length} branches`}
          >
            <IconBranch size="12" />
          </button>
        )}

        {/* Parent button (orange) */}
        {parentBranch && (
          <button
            onClick={() => {
              onSetPreserveScroll?.(true);
              onLoadSession?.(parentBranch.parentSessionId);
            }}
            className="
              p-1 rounded-md
              text-orange-500 dark:text-orange-400
              hover:text-orange-600 hover:scale-110 dark:hover:text-orange-300
              hover:bg-orange-100/50 dark:hover:bg-orange-900/20
              transition-all duration-200 opacity-100 cursor-pointer
            "
            title="Go to parent session"
          >
            <IconBranch size="12" />
          </button>
        )}
      </div>

      {/* Hover-only buttons */}
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0 ${reverseClass}`}>
        {/* Edit */}
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

        {/* Revert */}
        {canShowRevert && onRevert && eventId && (
          <button
            onClick={() => onRevert(eventId)}
            className={HOVER_BUTTON_CLASS}
            title="Revert to this point"
          >
            <RotateCcw size="12" />
          </button>
        )}

        {/* Debug */}
        {canShowDebug && (
          <button
            onClick={onToggleDebug}
            className={HOVER_BUTTON_CLASS}
            title="Show debug view"
          >
            <IconFocusCenter size="12" />
          </button>
        )}

        {/* Translate */}
        {canShowTranslate && translationText && (
          <TranslateButton
            componentId={componentId}
            originalText={translationText}
          />
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

  return (
    <div className="flex items-center justify-center gap-3 py-1.5 select-none">
      <button
        onClick={() => canGoBack && onNavigate(activeViewIndex - 1)}
        disabled={!canGoBack}
        className={`p-0.5 rounded transition-colors ${
          canGoBack
            ? 'text-muted-foreground hover:text-foreground cursor-pointer'
            : 'text-muted-foreground/30 cursor-default'
        }`}
        aria-label="Previous view"
      >
        <ChevronLeft size={14} />
      </button>

      <span className="text-[11px] tabular-nums text-muted-foreground min-w-[3ch] text-center">
        {activeViewIndex + 1} / {viewCount}
      </span>

      <button
        onClick={() => canGoForward && onNavigate(activeViewIndex + 1)}
        disabled={!canGoForward}
        className={`p-0.5 rounded transition-colors ${
          canGoForward
            ? 'text-muted-foreground hover:text-foreground cursor-pointer'
            : 'text-muted-foreground/30 cursor-default'
        }`}
        aria-label="Next view"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
