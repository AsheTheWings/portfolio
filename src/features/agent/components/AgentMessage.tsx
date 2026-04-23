'use client';

/**
 * AgentMessage — Composite carousel component for agent responses
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { AgentThoughts } from './AgentThoughts';
import { DebugView } from './DebugView';
import { ToolCall } from './ToolCall';
import { getToolDisplayName, getToolStatus } from '../utils/tool-call';
import { MarkdownContent } from './MarkdownContent';
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionBranching } from '../hooks/useAgentSessionBranching';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import type { AgentSessionComponent, AgentSessionEvent, EditingData } from '../types';
import { isLightColor } from '../utils/color';
import { getAgentStatus, statusLabel } from '../utils/agent-status';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface AgentMessageProps {
  component: AgentSessionComponent;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const AgentMessage = React.memo(function AgentMessage({ component }: AgentMessageProps) {
  const { id, data, isStreaming, controls } = component;
  const items: AgentSessionComponent[] = data.items || [];
  const agentId = data.agentId as string | undefined;

  // Debug view is always view #1 (index 0) in the carousel
  const hasDebugView = !!controls?.debug;
  const itemOffset = hasDebugView ? 1 : 0;

  // ── View state ──────────────────────────────────────────
  const [activeViewIndex, setActiveViewIndex] = useState(() => defaultViewIndex(items, itemOffset));

  // ── Store selectors ─────────────────────────────────────
  const editingEventId = useAgentStore((s) => s.editingEventId);
  const editingData = useAgentStore((s) => s.editingData);
  const startEdit = useAgentStore((s) => s.startEdit);
  const updateEditingData = useAgentStore((s) => s.updateEditingData);
  const cancelEdit = useAgentStore((s) => s.cancelEdit);
  const setPreserveScrollOnSessionChange = useAgentStore((s) => s.setPreserveScrollOnSessionChange);
  // Read only this agent's status — not the whole map — to avoid re-rendering on unrelated updates
  const agentStatus = useAgentStore((s) => getAgentStatus(s.agentStatuses, agentId));

  // Agent avatar from acquired agents
  const acquiredAgent = useAgentStore((s) =>
    agentId && agentId !== 'none' ? s.acquiredAgents[agentId] : undefined
  );
  // Resolve agent display info (same pattern as AgentSessionPopover)
  const agentName = agentId === 'none' || !agentId ? 'Assistant' : (acquiredAgent?.name ?? 'Agent');
  const agentColor = agentId === 'none' || !agentId ? '#E2E8F0' : (acquiredAgent?.color ?? '#E2E8F0');
  const avatarImage = acquiredAgent?.avatarImage ?? null;

  // ── Branching ───────────────────────────────────────────
  const { submitEdit, revertToComponent } = useAgentSessionBranching();
  const { loadAgentSession } = useAgentSessionLifecycle();

  // ── Session events (aggregated from all items + composite) ──
  const allSessionEvents = useMemo<AgentSessionEvent[]>(() => {
    const seen = new Set<string>();
    const events: AgentSessionEvent[] = [];
    // Composite-level events
    for (const e of data.sessionEvents || []) {
      if (!seen.has(e.eventId)) { seen.add(e.eventId); events.push(e); }
    }
    // Sub-item events
    for (const item of items) {
      for (const e of item.data.sessionEvents || []) {
        if (!seen.has(e.eventId)) { seen.add(e.eventId); events.push(e); }
      }
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events;
  }, [data.sessionEvents, items]);

  // ── Debug view as carousel view (always index 0) ────────
  const totalViews = items.length + (hasDebugView ? 1 : 0);

  // ── Active item ─────────────────────────────────────────
  const clampedIndex = Math.min(activeViewIndex, Math.max(totalViews - 1, 0));
  const isShowingDebug = hasDebugView && clampedIndex === 0;
  const activeItem = isShowingDebug ? undefined : items[clampedIndex - itemOffset];

  // ── Determine if active item is being edited ────────────
  const isEditMode = !!activeItem && editingEventId === activeItem.id;
  const [isValidForSubmit, setIsValidForSubmit] = useState(true);

  // ── Auto-advance to latest streaming item ───────────────
  useEffect(() => {
    if (!isStreaming) return;
    const lastIdx = items.length - 1;
    if (lastIdx >= 0) {
      setActiveViewIndex(lastIdx + itemOffset);
    }
  }, [isStreaming, items.length, itemOffset]);

  // ── Collapse listener (agent:collapseAll) ───────────────
  useEffect(() => {
    const onCollapse = () => {
      setActiveViewIndex(defaultViewIndex(items, itemOffset));
    };
    window.addEventListener('agent:collapseAll', onCollapse);
    return () => window.removeEventListener('agent:collapseAll', onCollapse);
  }, [items, itemOffset]);

  // ── Escape to cancel edit ───────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditMode, cancelEdit]);

  // ── Branch data from all session events ─────────────────
  const branches: BranchInfo[] = useMemo(() => {
    return allSessionEvents
      .filter((e): e is Extract<AgentSessionEvent, { type: 'branch' }> =>
        e.type === 'branch' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId as string,
        timestamp: e.timestamp,
      }));
  }, [allSessionEvents]);

  const parentBranch: ParentBranchInfo | undefined = useMemo(() => {
    const found = allSessionEvents.find((e): e is Extract<AgentSessionEvent, { type: 'branch' }> =>
      e.type === 'branch' && !!e.data.parentSessionId
    );
    return found ? { parentSessionId: found.data.parentSessionId as string } : undefined;
  }, [allSessionEvents]);

  // ── Height mode per active view type ────────────────────
  const heightMode = isShowingDebug
    ? 'fixed'
    : activeItem
      ? (activeItem.type === 'message' ? 'auto' : 'fixed')
      : 'auto';

  // ── View title (centered in top bar, last view/messages get none) ──
  const viewTitle = useMemo(() => {
    if (isShowingDebug) return 'Agent Session Events';
    if (!activeItem) return undefined;
    if (activeItem.type === 'agent-thoughts') return 'Thoughts';
    if (activeItem.type === 'tool-call') {
      const status = getToolStatus(activeItem.data);
      const displayName = getToolDisplayName(activeItem.data);
      return (
        <span className="flex items-center gap-1.5">
          {displayName}
          {status === 'executing' && <ThreeDotsScaleMiddleIcon size={12} />}
          {status === 'complete' && <Check size={12} />}
          {status === 'failed' && <X size={12} className="text-red-500" />}
        </span>
      );
    }
    return undefined;
  }, [isShowingDebug, activeItem]);

  // ── Streaming status label ──────────────────────────────
  const streamingStatus = isStreaming ? statusLabel(agentStatus) : undefined;

  // ── Edit callbacks ──────────────────────────────────────
  const handleStartEdit = useCallback(
    () => {
      if (!activeItem) return;
      const item = activeItem;
      if (item.type === 'tool-call') {
        startEdit(item.id, {
          arguments: item.data.arguments || {},
          result: item.data.result,
        });
      } else if (item.type === 'message') {
        startEdit(item.id, item.data.message || '');
      } else if (item.type === 'agent-thoughts') {
        startEdit(item.id, item.data.thoughts || '');
      }
    },
    [startEdit, activeItem],
  );

  const handleSubmitEdit = useCallback(() => {
    const store = useAgentStore.getState();
    if (store.editingEventId && store.editingData) {
      submitEdit(store.editingEventId, store.editingData);
    }
  }, [submitEdit]);

  const handleRevert = useCallback(
    (_eventId: string) => {
      // For revert: find the last non-branch event across all items in this group
      const lastNonBranch = allSessionEvents.findLast(e => e.type !== 'branch');
      if (lastNonBranch) {
        revertToComponent(lastNonBranch.eventId);
      }
    },
    [allSessionEvents, revertToComponent],
  );

  // ── Translation support ─────────────────────────────────
  const activeLanguage = useAgentStore((s) => activeItem ? s.activeTranslations[activeItem.id] : undefined);
  const cachedTranslation = useAgentStore((s) =>
    activeItem && activeLanguage ? s.translationCache[activeItem.id]?.[activeLanguage] : undefined
  );
  const translationText = activeItem?.type === 'message'
    ? (activeLanguage && cachedTranslation ? cachedTranslation : activeItem.data.message || '')
    : undefined;

  // ── Build control bar config ────────────────────────────
  const controlBarConfig = useMemo(() => ({
    controls: {
      ...controls,
      translate: controls?.translate && activeItem?.type === 'message',
    },
    eventId: activeItem?.id,
    componentId: id,
    role: 'agent' as const,
    translationText: activeItem?.type === 'message' ? (activeItem.data.message || '') : undefined,
    isEditMode,
    isValidForSubmit,
    onStartEdit: handleStartEdit,
    onSubmitEdit: handleSubmitEdit,
    onRevert: handleRevert,
  }), [controls, activeItem, id, isEditMode, isValidForSubmit, handleStartEdit, handleSubmitEdit, handleRevert]);

  // ── Render active view ──────────────────────────────────
  const renderActiveView = () => {
    if (isShowingDebug) {
      return <DebugView sessionEvents={allSessionEvents} />;
    }
    if (!activeItem) return null;
    return (
      <SubViewRenderer
        item={activeItem}
        isEditMode={isEditMode}
        editingData={editingData}
        updateEditingData={updateEditingData}
        onSubmitEdit={handleSubmitEdit}
        cancelEdit={cancelEdit}
        onValidationChange={setIsValidForSubmit}
        translationContent={translationText}
      />
    );
  };

  return (
    <div className="w-[80%] relative">
      <div
        className="session-component rounded-2xl relative bg-white dark:bg-surface-1 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] rounded-tl-md min-w-0"
        style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: agentColor }}
      >
        {/* Agent avatar — on top of bubble */}
        <div
          className="absolute -left-5 -top-1 w-10 h-10 rounded-full overflow-hidden z-[10]"
          style={{ backgroundColor: agentColor }}
        >
          {avatarImage ? (
            <img src={avatarImage} alt={agentName} className="absolute inset-0 w-full h-full object-cover rounded-full" style={{ border: `1px solid ${agentColor}` }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-xs font-bold antialiased"
                style={{ color: isLightColor(agentColor) ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', textRendering: 'optimizeLegibility' }}
              >
                {agentName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <ComponentShell
          role="agent"
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
          viewTitle={viewTitle}
          streamingStatus={streamingStatus}
        >
          {renderActiveView()}
        </ComponentShell>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────────────────────
// SubViewRenderer — Renders the active item with appropriate
// Sub-view renderer — passes props directly to sub-components
// ────────────────────────────────────────────────────────────

interface SubViewRendererProps {
  item: AgentSessionComponent;
  isEditMode: boolean;
  editingData: EditingData | null | undefined;
  updateEditingData: (data: EditingData) => void;
  onSubmitEdit: () => void;
  cancelEdit: () => void;
  onValidationChange: (valid: boolean) => void;
  translationContent?: string;
}

function SubViewRenderer({
  item,
  isEditMode,
  editingData,
  updateEditingData,
  onSubmitEdit,
  cancelEdit,
  onValidationChange,
  translationContent,
}: SubViewRendererProps) {
  switch (item.type) {
    case 'agent-thoughts':
      return (
        <AgentThoughts
          thoughts={item.data.thoughts}
          isStreaming={item.isStreaming}
        />
      );

    case 'tool-call': {
      return (
        <ToolCall
          data={item.data}
          isEditMode={isEditMode}
          editingData={isEditMode ? editingData : undefined}
          onUpdateEditingData={updateEditingData}
          onSubmitEdit={onSubmitEdit}
          onValidationChange={onValidationChange}
        />
      );
    }

    case 'message':
      return (
        <MarkdownContent content={translationContent || item.data.message || ''} />
      );

    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Default view index: response (last message item) if available, otherwise last item.
 *  debugOffset shifts all item indices when debug view occupies index 0. */
function defaultViewIndex(items: AgentSessionComponent[], debugOffset: number = 0): number {
  if (items.length === 0) return 0;
  // Prefer the last 'message' type item (the response)
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'message') return i + debugOffset;
  }
  // Fallback to last item
  return items.length - 1 + debugOffset;
}

