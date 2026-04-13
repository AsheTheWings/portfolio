'use client';

/**
 * AgentMessage — Composite carousel component for agent responses
 *
 * Renders a grouped set of sub-views (thoughts, tool-calls, text response)
 * from `data.items` with arrow-based carousel navigation.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ [Controls: edit | revert | debug]  [🤖]  │  ← Top bar + agent avatar
 *   ├──────────────────────────────────────────┤
 *   │  Active view content (thoughts/tool/msg) │
 *   ├──────────────────────────────────────────┤
 *   │         ◀  2 / 5  ▶                     │  ← Navigation
 *   └──────────────────────────────────────────┘
 *
 * Height modes:
 *   - fixed (~300px, scrollable) for thoughts and tool-call views
 *   - auto (grows to fit) for message/response views
 *
 * Auto-advances to latest streaming item. Collapses to default view
 * on `agent:collapseAll` DOM event.
 *
 * Uses ComponentShell for control bar, debug overlay, and branch navigation.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgentThoughts } from './AgentThoughts';
import { ToolCall } from './ToolCall';
import { MarkdownContent } from './MarkdownContent';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionBranching } from '../hooks/useAgentSessionBranching';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import type { AgentSessionComponent, AgentSessionEvent, EditingData } from '../types';

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

  // ── View state ──────────────────────────────────────────
  const [activeViewIndex, setActiveViewIndex] = useState(() => defaultViewIndex(items));
  const [isDebugView, setIsDebugView] = useState(false);

  // ── Store selectors ─────────────────────────────────────
  const editingEventId = useAgentStore((s) => s.editingEventId);
  const editingData = useAgentStore((s) => s.editingData);
  const startEdit = useAgentStore((s) => s.startEdit);
  const updateEditingData = useAgentStore((s) => s.updateEditingData);
  const cancelEdit = useAgentStore((s) => s.cancelEdit);
  const setPreserveScrollOnSessionChange = useAgentStore((s) => s.setPreserveScrollOnSessionChange);

  // Agent avatar from acquired agents
  const acquiredAgent = useAgentStore((s) =>
    agentId && agentId !== 'none' ? s.acquiredAgents[agentId] : undefined
  );
  const avatarImage = acquiredAgent?.avatarImage;
  const agentColor = acquiredAgent?.color;

  // ── Branching ───────────────────────────────────────────
  const { submitEdit, revertToComponent } = useAgentSessionBranching();
  const { loadAgentSession } = useAgentSessionLifecycle();

  // ── Active item ─────────────────────────────────────────
  const clampedIndex = Math.min(activeViewIndex, Math.max(items.length - 1, 0));
  const activeItem = items[clampedIndex];

  // ── Determine if active item is being edited ────────────
  const isEditMode = !!activeItem && editingEventId === activeItem.id;
  const [isValidForSubmit, setIsValidForSubmit] = useState(true);

  // ── Auto-advance to latest streaming item ───────────────
  useEffect(() => {
    if (!isStreaming) return;
    // Find the last streaming or most recently added item
    const lastIdx = items.length - 1;
    if (lastIdx >= 0) {
      setActiveViewIndex(lastIdx);
    }
  }, [isStreaming, items.length]);

  // ── Collapse listener (agent:collapseAll) ───────────────
  useEffect(() => {
    const onCollapse = () => {
      setActiveViewIndex(defaultViewIndex(items));
      setIsDebugView(false);
    };
    window.addEventListener('agent:collapseAll', onCollapse);
    return () => window.removeEventListener('agent:collapseAll', onCollapse);
  }, [items]);

  // ── Escape to cancel edit ───────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditMode, cancelEdit]);

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
  const heightMode = activeItem
    ? (activeItem.type === 'message' ? 'auto' : 'fixed')
    : 'auto';

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
    <div className="flex flex-col items-start">
      <div className="session-component rounded-2xl relative text-foreground rounded-tl-md w-full">
        {/* Agent avatar (top-right) */}
        {avatarImage && (
          <div className="absolute -top-2 -right-2 z-10">
            <img
              src={avatarImage}
              alt="Agent"
              className="w-6 h-6 rounded-full ring-2 ring-background object-cover"
              style={agentColor ? { borderColor: agentColor } : undefined}
            />
          </div>
        )}

        <ComponentShell
          role="agent"
          controlBar={controlBarConfig}
          viewCount={items.length}
          activeViewIndex={clampedIndex}
          onNavigate={setActiveViewIndex}
          branches={branches}
          parentBranch={parentBranch}
          sessionEvents={allSessionEvents}
          isDebugView={isDebugView}
          onToggleDebug={() => setIsDebugView(v => !v)}
          heightMode={heightMode}
          onLoadSession={loadAgentSession}
          onSetPreserveScroll={setPreserveScrollOnSessionChange}
          isStreaming={isStreaming ?? false}
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
          maxLines={8}
          thoughts={item.data.thoughts}
          isStreaming={item.isStreaming}
        />
      );

    case 'tool-call':
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

/** Default view index: response (last message item) if available, otherwise last item */
function defaultViewIndex(items: AgentSessionComponent[]): number {
  if (items.length === 0) return 0;
  // Prefer the last 'message' type item (the response)
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'message') return i;
  }
  // Fallback to last item
  return items.length - 1;
}
