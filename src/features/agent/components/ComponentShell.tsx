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

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Edit2, RotateCcw, Send } from 'lucide-react';
import IconBranch from '@/features/shared/icons/IconBranch';
import { TranslateButton } from './TranslateButton';
import { BranchTreeView } from './BranchTreeView';
import { useChatClickAway } from '../hooks/useChatClickAway';
import type { AgentSessionComponentControls, EditingData } from '../types';

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
  /** Height mode — 'fixed' (300px, scrollable viewport) | 'auto' (growable) */
  heightMode?: 'fixed' | 'auto';
  /** Callbacks for branch navigation */
  onLoadSession?: (sessionId: string) => void;
  onSetPreserveScroll?: (preserve: boolean) => void;
  /** Whether the component is streaming (hides controls during stream) */
  isStreaming?: boolean;
  /** Whether this component is selected (all controls turn cyan + stay visible) */
  isSelected?: boolean;
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

const SELECTED_BUTTON_CLASS = `
  p-1 rounded-md
  text-cyan-500 dark:text-cyan-400
  hover:text-cyan-400 hover:scale-110 dark:hover:text-cyan-300
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
  heightMode = 'auto',
  onLoadSession,
  onSetPreserveScroll,
  isStreaming = false,
  isSelected = false,
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
    hasControls || !!parentBranch || branches.length > 0 || viewCount > 1 || controlBar.isEditMode
  );

  return (
    <div
      ref={contentRef}
      className="relative group"
    >
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
            isSelected={isSelected}
          />
          {viewCount > 1 && (
            <div className={isSelected ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0'}>
              <ViewNavigation
                viewCount={viewCount}
                activeViewIndex={activeViewIndex}
                onNavigate={onNavigate}
                isSelected={isSelected}
              />
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
        <div
          className="px-4 py-8"
          style={heightMode === 'fixed' ? { height: FIXED_HEIGHT } : undefined}
        >
          {heightMode === 'fixed' ? (
            <div className="h-full overflow-y-auto scrollbar-hide">
              {children}
            </div>
          ) : (
            children
          )}
        </div>
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
  isSelected?: boolean;
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
  isSelected = false,
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
          className={`
            p-1 rounded-md
            hover:scale-110
            transition-all duration-200 cursor-pointer rotate-180
            ${isSelected
              ? 'text-cyan-500 dark:text-cyan-400 hover:text-cyan-400 dark:hover:text-cyan-300'
              : 'text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-900/20'
            }
          `}
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
          className={`
            p-1 rounded-md
            hover:scale-110
            transition-all duration-200 cursor-pointer
            ${isSelected
              ? 'text-cyan-500 dark:text-cyan-400 hover:text-cyan-400 dark:hover:text-cyan-300'
              : 'text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 hover:bg-orange-100/50 dark:hover:bg-orange-900/20'
            }
          `}
          title="Go to parent session"
        >
          <IconBranch size="12" />
        </button>
      )}

      {/* Action buttons — always visible when selected, hover-only otherwise */}
      <div className={`flex items-center gap-1 ${reverseClass} ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200 delay-300 group-hover:delay-0`}>
        {canShowEdit && onStartEdit && (
          <button
            data-edit-allowed
            onClick={() => onStartEdit(translationText || '')}
            className={isSelected ? SELECTED_BUTTON_CLASS : HOVER_BUTTON_CLASS}
            title="Edit"
          >
            <Edit2 size="12" />
          </button>
        )}

        {canShowRevert && onRevert && eventId && (
          <button
            onClick={() => onRevert(eventId)}
            className={isSelected ? SELECTED_BUTTON_CLASS : HOVER_BUTTON_CLASS}
            title="Revert to this point"
          >
            <RotateCcw size="12" />
          </button>
        )}

        {canShowTranslate && translationText && (
          <TranslateButton
            componentId={componentId}
            originalText={translationText}
            isSelected={isSelected}
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
  isSelected?: boolean;
}

function ViewNavigation({ viewCount, activeViewIndex, onNavigate, isSelected = false }: ViewNavigationProps) {
  const canGoBack = activeViewIndex > 0;
  const canGoForward = activeViewIndex < viewCount - 1;

  const NAV_BUTTON_ENABLED = isSelected
    ? `
      p-1 rounded-md
      text-cyan-500 dark:text-cyan-400
      hover:text-cyan-400 hover:scale-110 dark:hover:text-cyan-300
      transition-all duration-200
      cursor-pointer
    `
    : `
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

      <span className={`text-[11px] tabular-nums min-w-[3ch] text-center ${isSelected ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
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
