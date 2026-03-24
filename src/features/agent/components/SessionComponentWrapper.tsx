'use client';

/**
 * SessionComponentWrapper - Wrapper component with control buttons
 * Wraps session components and provides:
 * - Branch button (shows branches, creates new branches)
 * - Debug button (shows event inspection)
 * - Edit button (edit component content)
 * - Revert button (revert to this point)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Edit2, RotateCcw, Send } from 'lucide-react';
import IconFocusCenter from '@/features/shared/icons/IconFocusCenter';
import IconBranch from '@/features/shared/icons/IconBranch';
import { DebugView } from './DebugView';
import { BranchTreeView } from './BranchTreeView';
import { TranslateButton } from './TranslateButton';
import { useAgent } from '../contexts/AgentContext';
import { useSessionLifecycle } from '../hooks/useSessionLifecycle';
import { useSessionBranching } from '../hooks/useSessionBranching';
import { SessionComponentContext } from '../contexts/SessionComponentContext';
import { useChatClickAway } from '../hooks/useChatClickAway';
import type { SessionEvent, SessionComponent, SessionComponentType, SessionComponentControls, RenderContext, EditingData } from '../types';
import { useAgentStore } from '../stores/useAgentStore';

type PanelView = 'none' | 'debug' | 'branches' | 'edit';

interface Branch {
  branchSessionId: string;
  timestamp?: Date;
}

interface SessionComponentWrapperProps {
  children: React.ReactNode;
  componentId: string;
  componentRole?: 'user' | 'agent' | 'system';
  componentType?: SessionComponentType;
  
  // Full data object (includes isBackground, jobId for domain context)
  data: SessionComponent['data'];
  
  // Streaming state
  isStreaming: boolean;
  
  // Explicit controls (from component.controls)
  controls?: SessionComponentControls;
  
  showControls?: boolean;
  renderContext?: RenderContext;
}

export function SessionComponentWrapper({
  children,
  componentId,
  componentRole,
  componentType,
  data,
  isStreaming,
  controls,
  showControls = true,
  renderContext,
}: SessionComponentWrapperProps) {
  // Convenience accessors for internal logic
  const message = data.message;
  const thoughts = data.thoughts;
  const sessionEvents = data.sessionEvents;
  
  // Ref for click-away detection
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Get store state and actions
  const { editingComponentId, editingData, startEdit, updateEditingData, cancelEdit, setScrollToComponentId } = useAgent();
  
  // Branching operations
  const { submitEdit, revertToComponent } = useSessionBranching();
  
  // Session navigation
  const { loadSession } = useSessionLifecycle();

  // Extract branch info directly from sessionEvents
  const branches: Branch[] = useMemo(() => {
    return (sessionEvents || [])
      .filter((e): e is Extract<SessionEvent, { type: 'branch' }> => 
        e.type === 'branch' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId!,
        timestamp: e.timestamp,
      }));
  }, [sessionEvents]);
  
  // Check if this component has a parent link (branch event with parentSessionId)
  const parentBranch = useMemo(() => {
    return (sessionEvents || []).find((e): e is Extract<SessionEvent, { type: 'branch' }> => 
      e.type === 'branch' && !!e.data.parentSessionId
    );
  }, [sessionEvents]);
  
  const isParentLink = !!parentBranch;
  
  // Check if this component is being edited
  const isEditMode = editingComponentId === componentId;
  const editingDataForThis = useAgentStore((state) => state.editingComponentId === componentId ? state.editingData : undefined);
  const editingMessage = editingDataForThis?.message || '';
  const [activePanel, setActivePanel] = useState<PanelView>(isEditMode ? 'edit' : 'none');
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [isBranchLoading, setIsBranchLoading] = useState(false);
  const [isValidForSubmit, setIsValidForSubmit] = useState(true);

  // Track shift key state and handle escape key globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
      if (e.key === 'Escape' && isEditMode) {
        e.preventDefault();
        cancelEdit();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isEditMode, cancelEdit]);

  // Click outside to cancel edit mode
  // Edit mode: Only the component itself (contentRef) is protected
  useChatClickAway(contentRef, {
    mode: 'edit',
    enabled: isEditMode,
    onClickAway: () => {
      cancelEdit();
    },
    additionalAllowedSelectors: isEditMode ? ['[data-edit-allowed]'] : [],
  });

  // Debug view clickaway is managed within DebugView

  useEffect(() => {
    const onCollapseAll = (_e: Event) => {
      setActivePanel(prev => (prev === 'edit' ? 'edit' : 'none'));
    };
    window.addEventListener('agent:collapseAll', onCollapseAll);
    return () => {
      window.removeEventListener('agent:collapseAll', onCollapseAll);
    };
  }, []);

  // Control visibility - explicitly set via controls object
  const canShowDebug = controls?.debug;
  const canShowBranches = controls?.branch && branches.length > 0;
  const canShowEdit = controls?.edit;
  const canShowRevert = controls?.revert;
  const canShowTranslate = controls?.translate && componentType === 'message';

  // Sync edit mode with panel state
  React.useEffect(() => {
    if (isEditMode) {
      setActivePanel('edit');
    } else if (activePanel === 'edit') {
      setActivePanel('none');
    }
  }, [isEditMode, activePanel]);

  // Edit mode: only show submit button, scaled and cyan
  const editModeButton = isEditMode ? (
    <button
      data-edit-allowed
      onClick={() => {
        const { editingComponentId: ecid, editingData: edata } = useAgentStore.getState();
        submitEdit(ecid!, edata!);
      }}
      disabled={!isValidForSubmit}
      className={`
        p-1 rounded-md scale-[1.1]
        transition-all duration-200
        ${isValidForSubmit 
          ? 'text-cyan-400 dark:text-cyan-400 hover:text-cyan-300 hover:scale-[1.3] dark:hover:text-cyan-300 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/10' 
          : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
        }
      `}
      title={isValidForSubmit ? "Submit Edit" : "Fix validation errors to submit"}
    >
      <Send size="14" />
    </button>
  ) : null;

  // All control buttons in single row
  // Order: branch button nearest to content (rightmost for left position, leftmost for right position)
  const debugButton = canShowDebug ? (
    <button
      onClick={() => {
        setActivePanel('debug');
      }}
      className="
        p-1 rounded-md
        text-slate-400 dark:text-slate-500
        hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
        hover:bg-slate-200/50 dark:hover:bg-slate-700/50
        transition-all duration-200
        opacity-0 group-hover:opacity-100 cursor-pointer
      "
      aria-label="Show debug view"
      title="Show debug view"
    >
      <IconFocusCenter size="12" />
    </button>
  ) : null;

  const editButton = canShowEdit && !isEditMode ? (
    <button
      data-edit-allowed
      onClick={() => {
        // For messages: pass content string
        // For tool-calls: pass object with arguments + result (tool name is readonly)
        if (componentType === 'tool-call') {
          startEdit(componentId, {
            arguments: data.arguments || {},
            result: data.result,
          });
        } else {
          startEdit(componentId, message || thoughts || '');
        }
      }}
      className="
        p-1 rounded-md
        text-slate-400 dark:text-slate-500
        hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
        hover:bg-slate-200/50 dark:hover:bg-slate-700/50
        transition-all duration-200
        opacity-0 group-hover:opacity-100 cursor-pointer
      "
      aria-label="Edit component"
      title="Edit component"
    >
      <Edit2 size="12" />
    </button>
  ) : isEditMode ? (
    <button
      data-edit-allowed
      onClick={() => {
        const { editingComponentId: ecid, editingData: edata } = useAgentStore.getState();
        submitEdit(ecid!, edata!);
      }}
      className="
        p-1 rounded-md
        text-slate-400 dark:text-slate-500
        hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
        hover:bg-slate-200/50 dark:hover:bg-slate-700/50
        transition-all duration-200
        opacity-100 cursor-pointer
      "
      aria-label="Submit edit"
      title="Submit edit (creates branch)"
    >
      <Send size="12" />
    </button>
  ) : null;

  const revertButton = canShowRevert ? (
    <button
      onClick={() => {
        revertToComponent(componentId);
      }}
      className="
        p-1 rounded-md
        text-slate-400 dark:text-slate-500
        hover:text-cyan-500 hover:scale-110 dark:hover:text-slate-300
        hover:bg-slate-200/50 dark:hover:bg-slate-700/50
        transition-all duration-200
        opacity-0 group-hover:opacity-100 cursor-pointer
      "
      aria-label="Revert to this point"
      title="Revert to this point"
    >
      <RotateCcw size="12" />
    </button>
  ) : null;

  // Parent button (orange, normal rotation) - shown when this component is parent link
  const parentButton = isParentLink && parentBranch ? (
    <button
      onClick={async () => {
        if (parentBranch.type === 'branch' && parentBranch.data.parentSessionId) {
          setScrollToComponentId(componentId);
          await loadSession(parentBranch.data.parentSessionId);
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
  ) : null;

  // Branch button (purple, rotated) - shown when this component has child branches
  const branchButton = canShowBranches ? (
    <button
      onClick={() => {
        // If only one branch, directly load it; otherwise show branches panel
        if (branches.length === 1) {
          setScrollToComponentId(componentId);
          loadSession(branches[0].branchSessionId);
        } else {
          setActivePanel('branches');
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
  ) : null;

  
  const isAgentRole = componentRole !== 'user';
  const reverseClass = isAgentRole ? 'flex-row-reverse' : '';

  // Translate button (furthest from content)
  const translateButton = canShowTranslate ? (
    <TranslateButton
      componentId={componentId}
      originalText={message || ''}
      position={isAgentRole ? 'left' : 'right'}
    />
  ) : null;

  // Show control buttons only if any control is enabled
  const hasAnyControls = canShowDebug || canShowEdit || canShowRevert || canShowBranches || canShowTranslate;

  const controlButtons = !hasAnyControls ? null : (
    isEditMode ? (
      <div data-edit-allowed className={`flex items-center gap-1 ${reverseClass}`}>
        {editModeButton}
      </div>
    ) : (
      <div className={`flex items-center gap-1 ${reverseClass}`}>
        {/* Always visible buttons (nearest to content) */}
        <div className={`flex items-center gap-1 ${reverseClass}`}>
          {branchButton}
          {parentButton}
        </div>
        {/* Hover-only buttons */}
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0 ${reverseClass}`}>
          {editButton}
          {revertButton}
          {debugButton}
          {translateButton}
        </div>
      </div>
    )
  );

  // Create context value
  const contextValue = useMemo(() => ({
    componentId,
    componentType,
    componentRole,
    data,
    isStreaming,
    controls,
    renderContext,
    isEditMode,
    editingData: editingDataForThis,
    isValidForSubmit,
    onStartEdit: (data: string | EditingData) => startEdit(componentId, data),
    onUpdateEditingData: updateEditingData,
    onCancelEdit: cancelEdit,
    onSubmitEdit: () => {
      const { editingComponentId: ecid, editingData: edata } = useAgentStore.getState();
      submitEdit(ecid!, edata!);
    },
    onValidationChange: setIsValidForSubmit,
  }), [
    componentId,
    componentType,
    componentRole,
    data,
    isStreaming,
    controls,
    renderContext,
    isEditMode,
    editingDataForThis,
    isValidForSubmit,
    startEdit,
    updateEditingData,
    cancelEdit,
    submitEdit,
  ]);

  const renderContent = () => {
    if (activePanel === 'debug' || activePanel === 'branches') {
      return (
        <div className="flex-1">
          {activePanel === 'debug' ? (
            <DebugView
              sessionEvents={sessionEvents}
              onClose={() => {
                setActivePanel('none');
              }}
            />
          ) : (
            <BranchTreeView
              branches={branches}
              onSelectBranch={(branchSessionId) => {
                setScrollToComponentId(componentId);
                loadSession(branchSessionId);
              }}
              onClose={() => {
                setActivePanel('none');
              }}
            />
          )}
        </div>
      );
    }
    return children;
  };

  // Handle shift+click to toggle debug view (disabled in edit mode)
  const handleShiftClick = (e: React.MouseEvent) => {
    // Ignore shift+click on control buttons
    const target = e.target as HTMLElement;
    if (target.closest('[data-controls]')) return;
    
    // Shift+click always accessible for debug (power user feature)
    if (e.shiftKey && sessionEvents && sessionEvents.length > 0 && !isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      setActivePanel(prev => prev === 'debug' ? 'none' : 'debug');
    }
  };

  // Determine cursor style - shift+click accessible if events exist
  const cursorStyle = isShiftHeld && sessionEvents && sessionEvents.length > 0 && !isEditMode ? 'cursor-pointer' : '';

  return (
    <SessionComponentContext.Provider value={contextValue}>
      <div 
        ref={contentRef}
        className={`relative ${showControls ? 'group' : ''} ${cursorStyle}`}
        onClick={handleShiftClick}
      >
        {/* Control buttons - absolutely positioned based on role */}
        {showControls && hasAnyControls && activePanel !== 'debug' && (
          <div 
            data-controls
            className={`absolute z-99 w-[100px] ${componentRole === 'user' ? 'right-[-6.4rem]' : 'left-[-6.4rem]'}`}
          >
            {controlButtons}
          </div>
        )}
        
        {renderContent()}
      </div>
    </SessionComponentContext.Provider>
  );
}

// Export Branch interface for external use
export type { Branch };
