'use client';

/**
 * ComponentControls - Control buttons for session components
 * Extracted from AgentSessionComponentWrapper to isolate rendering logic.
 * 
 * Renders: debug, edit, revert, branch, parent, translate buttons
 * Handles: control visibility, edit-mode submit, button layout
 */

import React from 'react';
import { Edit2, RotateCcw, Send } from 'lucide-react';
import IconFocusCenter from '@/features/shared/icons/IconFocusCenter';
import IconBranch from '@/features/shared/icons/IconBranch';
import { TranslateButton } from './TranslateButton';
import { useAgentStore } from '../stores/useAgentStore';
import type { AgentSessionComponent, AgentSessionComponentType, AgentSessionComponentControls, AgentSessionEvent } from '../types';

interface Branch {
  branchSessionId: string;
  timestamp?: Date;
}

interface ComponentControlsProps {
  componentId: string;
  componentRole?: 'user' | 'agent' | 'system';
  componentType?: AgentSessionComponentType;
  controls?: AgentSessionComponentControls;
  data: AgentSessionComponent['data'];
  isEditMode: boolean;
  isValidForSubmit: boolean;
  branches: Branch[];
  parentBranch?: Extract<AgentSessionEvent, { type: 'branch' }>;
  // Callbacks
  onStartEdit: (componentId: string, data: string | { arguments?: Record<string, unknown>; result?: unknown }) => void;
  onSubmitEdit: () => void;
  onRevert: (componentId: string) => void;
  onLoadSession: (sessionId: string) => void;
  onSetActivePanel: (panel: 'debug' | 'branches') => void;
  onSetPreserveScroll: (preserve: boolean) => void;
}

const HOVER_BUTTON_CLASS = `
  p-1 rounded-md
  text-slate-400 dark:text-slate-500
  hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
  hover:bg-slate-200/50 dark:hover:bg-slate-700/50
  transition-all duration-200
  opacity-0 group-hover:opacity-100 cursor-pointer
`;

export function ComponentControls({
  componentId,
  componentRole,
  componentType,
  controls,
  data,
  isEditMode,
  isValidForSubmit,
  branches,
  parentBranch,
  onStartEdit,
  onSubmitEdit,
  onRevert,
  onLoadSession,
  onSetActivePanel,
  onSetPreserveScroll,
}: ComponentControlsProps) {
  const message = data.message;
  const thoughts = data.thoughts;
  const isParentLink = !!parentBranch;

  // Hide revert on the last non-system component (nothing after it to revert to)
  const isLastComponent = useAgentStore((state) => {
    const comps = state.sessionComponents;
    for (let i = comps.length - 1; i >= 0; i--) {
      if (comps[i].role !== 'system') return comps[i].id === componentId;
    }
    return false;
  });

  const canShowDebug = controls?.debug;
  const canShowBranches = controls?.branch && branches.length > 0;
  const canShowEdit = controls?.edit;
  const canShowRevert = controls?.revert && !isLastComponent;
  const canShowTranslate = controls?.translate && componentType === 'message';
  const hasAnyControls = canShowDebug || canShowEdit || canShowRevert || canShowBranches || canShowTranslate;

  if (!hasAnyControls) return null;

  const isAgentRole = componentRole !== 'user';
  const reverseClass = isAgentRole ? 'flex-row-reverse' : '';

  // Edit mode: only show submit button
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
          title={isValidForSubmit ? "Submit Edit" : "Fix validation errors to submit"}
        >
          <Send size="14" />
        </button>
      </div>
    );
  }

  // Normal mode: all control buttons
  return (
    <div className={`flex items-center gap-1 ${reverseClass}`}>
      {/* Always visible buttons (nearest to content) */}
      <div className={`flex items-center gap-1 ${reverseClass}`}>
        {/* Branch button (purple, rotated) */}
        {canShowBranches && (
          <button
            onClick={() => {
              if (branches.length === 1) {
                onSetPreserveScroll(true);
                onLoadSession(branches[0].branchSessionId);
              } else {
                onSetActivePanel('branches');
              }
            }}
            className="
              p-1 rounded-md
              text-purple-500 dark:text-purple-400
              hover:text-purple-600 hover:scale-110 dark:hover:text-purple-300
              hover:bg-purple-100/50 dark:hover:bg-purple-900/20
              transition-all duration-200
              opacity-100 cursor-pointer
              rotate-180
            "
            aria-label={branches.length === 1 ? "Switch to branch" : "Show branches"}
            title={branches.length === 1 ? "Switch to branch" : `Show ${branches.length} branches`}
          >
            <IconBranch size="12" />
          </button>
        )}

        {/* Parent button (orange, normal rotation) */}
        {isParentLink && parentBranch && (
          <button
            onClick={async () => {
              if (parentBranch.type === 'branch' && parentBranch.data.parentSessionId) {
                onSetPreserveScroll(true);
                await onLoadSession(parentBranch.data.parentSessionId);
              }
            }}
            className="
              p-1 rounded-md
              text-orange-500 dark:text-orange-400
              hover:text-orange-600 hover:scale-110 dark:hover:text-orange-300
              hover:bg-orange-100/50 dark:hover:bg-orange-900/20
              transition-all duration-200
              opacity-100 cursor-pointer
            "
            aria-label="Go to parent session"
            title="Go to parent session"
          >
            <IconBranch size="12" />
          </button>
        )}
      </div>

      {/* Hover-only buttons */}
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0 ${reverseClass}`}>
        {/* Edit button */}
        {canShowEdit && (
          <button
            data-edit-allowed
            onClick={() => {
              if (componentType === 'tool-call') {
                onStartEdit(componentId, {
                  arguments: data.arguments || {},
                  result: data.result,
                });
              } else {
                onStartEdit(componentId, message || thoughts || '');
              }
            }}
            className={HOVER_BUTTON_CLASS}
            aria-label="Edit component"
            title="Edit component"
          >
            <Edit2 size="12" />
          </button>
        )}

        {/* Revert button */}
        {canShowRevert && (
          <button
            onClick={() => onRevert(componentId)}
            className={HOVER_BUTTON_CLASS}
            aria-label="Revert to this point"
            title="Revert to this point"
          >
            <RotateCcw size="12" />
          </button>
        )}

        {/* Debug button */}
        {canShowDebug && (
          <button
            onClick={() => onSetActivePanel('debug')}
            className={HOVER_BUTTON_CLASS}
            aria-label="Show debug view"
            title="Show debug view"
          >
            <IconFocusCenter size="12" />
          </button>
        )}

        {/* Translate button */}
        {canShowTranslate && (
          <TranslateButton
            componentId={componentId}
            originalText={message || ''}
            position={isAgentRole ? 'left' : 'right'}
          />
        )}
      </div>
    </div>
  );
}

export type { Branch };
