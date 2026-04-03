'use client';

/**
 * AgentSessionComponentWrapper - Wrapper component with control buttons
 * Wraps session components and provides:
 * - Branch button (shows branches, creates new branches)
 * - Debug button (shows event inspection)
 * - Edit button (edit component content)
 * - Revert button (revert to this point)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DebugView } from './DebugView';
import { BranchTreeView } from './BranchTreeView';
import { ComponentControls } from './ComponentControls';
import { useAgent } from '../hooks/useAgent';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import { useAgentSessionBranching } from '../hooks/useAgentSessionBranching';
import { AgentSessionComponentContext } from '../contexts/AgentSessionComponentContext';
import { useChatClickAway } from '../hooks/useChatClickAway';
import type { AgentSessionEvent, AgentSessionComponent, AgentSessionComponentType, AgentSessionComponentControls, RenderContext, EditingData } from '../types';
import { useAgentStore } from '../stores/useAgentStore';

type PanelView = 'none' | 'debug' | 'branches' | 'edit';

interface Branch {
  branchSessionId: string;
  timestamp?: Date;
}

interface AgentSessionComponentWrapperProps {
  children: React.ReactNode;
  componentId: string;
  componentRole?: 'user' | 'agent' | 'system';
  componentType?: AgentSessionComponentType;
  
  // Full data object (includes isBackground, jobId for domain context)
  data: AgentSessionComponent['data'];
  
  // Streaming state
  isStreaming: boolean;
  
  // Explicit controls (from component.controls)
  controls?: AgentSessionComponentControls;
  
  showControls?: boolean;
  renderContext?: RenderContext;
}

export function AgentSessionComponentWrapper({
  children,
  componentId,
  componentRole,
  componentType,
  data,
  isStreaming,
  controls,
  showControls = true,
  renderContext,
}: AgentSessionComponentWrapperProps) {
  // Convenience accessors for internal logic
  const message = data.message;
  const thoughts = data.thoughts;
  const sessionEvents = data.sessionEvents;
  
  // Ref for click-away detection
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Get store state and actions
  const { editingComponentId, editingData, startEdit, updateEditingData, cancelEdit, setPreserveScrollOnSessionChange } = useAgent();
  
  // Branching operations
  const { submitEdit, revertToComponent } = useAgentSessionBranching();
  
  // Session navigation
  const { loadAgentSession } = useAgentSessionLifecycle();

  // Extract branch info directly from sessionEvents
  const branches: Branch[] = useMemo(() => {
    return (sessionEvents || [])
      .filter((e): e is Extract<AgentSessionEvent, { type: 'branch' }> => 
        e.type === 'branch' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId!,
        timestamp: e.timestamp,
      }));
  }, [sessionEvents]);
  
  // Check if this component has a parent link (branch event with parentSessionId)
  const parentBranch = useMemo(() => {
    return (sessionEvents || []).find((e): e is Extract<AgentSessionEvent, { type: 'branch' }> => 
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

  // Sync edit mode with panel state
  React.useEffect(() => {
    if (isEditMode) {
      setActivePanel('edit');
    } else if (activePanel === 'edit') {
      setActivePanel('none');
    }
  }, [isEditMode, activePanel]);

  // Stable callback for ComponentControls submit
  const handleSubmitEdit = React.useCallback(() => {
    const { editingComponentId: ecid, editingData: edata } = useAgentStore.getState();
    submitEdit(ecid!, edata!);
  }, [submitEdit]);

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
                setPreserveScrollOnSessionChange(true);
                loadAgentSession(branchSessionId);
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
    <AgentSessionComponentContext.Provider value={contextValue}>
      <div 
        ref={contentRef}
        className={`relative ${showControls ? 'group' : ''} ${cursorStyle}`}
        onClick={handleShiftClick}
      >
        {/* Control buttons - absolutely positioned based on role */}
        {showControls && activePanel !== 'debug' && (
          <div 
            data-controls
            className={`absolute z-99 w-[100px] ${componentRole === 'user' ? 'right-[-6.4rem]' : 'left-[-6.4rem]'}`}
          >
            <ComponentControls
              componentId={componentId}
              componentRole={componentRole}
              componentType={componentType}
              controls={controls}
              data={data}
              isEditMode={isEditMode}
              isValidForSubmit={isValidForSubmit}
              branches={branches}
              parentBranch={parentBranch}
              onStartEdit={startEdit}
              onSubmitEdit={handleSubmitEdit}
              onRevert={revertToComponent}
              onLoadSession={loadAgentSession}
              onSetActivePanel={setActivePanel}
              onSetPreserveScroll={setPreserveScrollOnSessionChange}
            />
          </div>
        )}
        
        {renderContent()}
      </div>
    </AgentSessionComponentContext.Provider>
  );
}

