'use client';

/**
 * AgentMessage — Composite carousel component for agent responses
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { AgentThoughts } from './AgentThoughts';
import { DebugView } from './DebugView';
import { ToolCall } from './ToolCall';
import { FeedbackPanel } from './FeedbackPanel';
import { getToolDisplayName, getToolStatus } from '../utils/tool-call';
import { MarkdownContent } from './MarkdownContent';
import { ThreeDotsScaleMiddleIcon } from '@portfolio/ui/icons/ThreeDotsScaleMiddleIcon';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { AgentAvatar } from './AgentAvatar';
import { useAgentStore } from '../stores/useAgentStore';
import { useSessionBranching } from '../hooks/useSessionBranching';
import { useSessionLifecycle } from '../hooks/useSessionLifecycle';
import { useWorkflow } from '../hooks/useWorkflow';
import type { SessionComponent, SessionEvent, EditingData, FeedbackAction } from '../types';
import { getAgentStatus, statusLabel } from '../utils/status';

// ────────────────────────────────────────────────────────────
// View slots — discriminated union of carousel views
// ────────────────────────────────────────────────────────────

type ViewSlot =
  | { kind: 'debug' }
  | { kind: 'item'; item: SessionComponent }
  | { kind: 'feedback'; toolCallEventId: string; prompt: string; actions: FeedbackAction[] };

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface AgentMessageProps {
  component: SessionComponent;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export const AgentMessage = React.memo(function AgentMessage({ component }: AgentMessageProps) {
  const { id, data, isStreaming, controls } = component;
  const items = useMemo<SessionComponent[]>(() => data.items || [], [data.items]);
  const agentId = data.agentId as string | undefined;

  // ── View mode ───────────────────────────────────────────
  const viewMode = useAgentStore((s) => s.viewMode);
  const isUserMode = viewMode === 'user';
  const hasDebugView = isUserMode ? false : !!controls?.debug;

  // ── Store selectors ─────────────────────────────────────
  const editingEventId = useAgentStore((s) => s.editingEventId);
  const editingData = useAgentStore((s) => s.editingData);
  const startEdit = useAgentStore((s) => s.startEdit);
  const updateEditingData = useAgentStore((s) => s.updateEditingData);
  const cancelEdit = useAgentStore((s) => s.cancelEdit);
  const setPreserveScrollOnSessionChange = useAgentStore((s) => s.setPreserveScrollOnSessionChange);
  const agentStatus = useAgentStore((s) => getAgentStatus(s.agentStatuses, agentId));

  // Agent avatar from acquired agents
  const acquiredAgent = useAgentStore((s) =>
    agentId && agentId !== 'none' ? s.acquiredAgents[agentId] : undefined
  );
  const agentName = agentId === 'none' || !agentId ? 'Assistant' : (acquiredAgent?.name ?? 'Agent');
  const agentColor = agentId === 'none' || !agentId ? '#E2E8F0' : (acquiredAgent?.color ?? '#E2E8F0');
  const avatarImage = acquiredAgent?.avatarImage ?? null;

  // ── Hooks ───────────────────────────────────────────────
  const { submitEdit, revertToComponent } = useSessionBranching();
  const { loadSession } = useSessionLifecycle();
  const { submitFeedback } = useWorkflow();

  // ── Session events (aggregated from items + composite) ──
  const allSessionEvents = useMemo<SessionEvent[]>(() => {
    const seen = new Set<string>();
    const events: SessionEvent[] = [];
    for (const e of data.sessionEvents || []) {
      if (!seen.has(e.eventId)) { seen.add(e.eventId); events.push(e); }
    }
    for (const item of items) {
      for (const e of item.data.sessionEvents || []) {
        if (!seen.has(e.eventId)) { seen.add(e.eventId); events.push(e); }
      }
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events;
  }, [data.sessionEvents, items]);

  // ── Build view slots ────────────────────────────────────
  // Slot order: [debug?] then for each item: the item.
  // followed by a synthesized feedback slot when the item is a tool-call with
  // pending userActions (toolEffects.userActions present and no matching
  // user-feedback-result event yet).
  const viewSlots: ViewSlot[] = useMemo(() => {
    const resolvedFeedbackIds = new Set(
      allSessionEvents
        .filter((e) => e.type === 'user-feedback-result' && e.toolCallEventId)
        .map((e) => e.toolCallEventId as string),
    );
    const slots: ViewSlot[] = [];
    if (hasDebugView) slots.push({ kind: 'debug' });
    for (const it of items) {
      const pending =
        it.type === 'tool-call' &&
        it.data.toolEffects?.userActions &&
        !resolvedFeedbackIds.has(it.id)
          ? it.data.toolEffects.userActions
          : undefined;
      
      slots.push({ kind: 'item', item: it });
      
      if (pending) {
        slots.push({
          kind: 'feedback',
          toolCallEventId: it.id,
          prompt: pending.prompt,
          actions: pending.actions,
        });
      }
    }
    return slots;
  }, [items, hasDebugView, allSessionEvents]);

  const totalViews = viewSlots.length;

  // ── View state ──────────────────────────────────────────
  const [activeViewIndex, setActiveViewIndex] = useState(() => defaultSlotIndex(viewSlots));
  const previousViewModeRef = useRef(viewMode);

  // ── Active slot ─────────────────────────────────────────
  const clampedIndex = Math.min(activeViewIndex, Math.max(totalViews - 1, 0));
  const activeSlot: ViewSlot | undefined = viewSlots[clampedIndex];
  const isShowingDebug = activeSlot?.kind === 'debug';
  const activeItem = activeSlot?.kind === 'item' ? activeSlot.item : undefined;
  const activeFeedback = activeSlot?.kind === 'feedback' ? activeSlot : undefined;

  const [isExpanded, setIsExpanded] = useState(false);

  // ── Determine if active item is being edited ────────────
  const isEditMode = !!activeItem && editingEventId === activeItem.id;
  const [isValidForSubmit, setIsValidForSubmit] = useState(true);

  // ── Auto-advance: prefer pending feedback > streaming tail ──
  // Track which feedback slots we've already auto-advanced to so that
  // dismissing/navigating away does not bounce the user back.
  const advancedFeedbacksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. New pending feedback → jump to it once.
    const pendingIdx = viewSlots.findIndex(
      (s) => s.kind === 'feedback' && !advancedFeedbacksRef.current.has(s.toolCallEventId),
    );
    if (pendingIdx !== -1) {
      const slot = viewSlots[pendingIdx] as { kind: 'feedback'; toolCallEventId: string };
      advancedFeedbacksRef.current.add(slot.toolCallEventId);
      setActiveViewIndex(pendingIdx);
      return;
    }
    // 2. Streaming → advance automatically.
    if (isStreaming) {
      const messageIdx = viewSlots.findIndex((s) => s.kind === 'item' && s.item.type === 'message');
      const messageItem = items.find((it) => it.type === 'message');
      const hasMessageContent = !!messageItem && (messageItem.data.message || messageItem.isStreaming);

      if (hasMessageContent && messageIdx !== -1) {
        setActiveViewIndex(messageIdx);
      } else {
        const lastOverlayIdx = viewSlots.findLastIndex((s) => s.kind === 'item' && s.item.type !== 'message');
        if (lastOverlayIdx !== -1) {
          setActiveViewIndex(lastOverlayIdx);
        }
      }
    }
  }, [viewSlots, isStreaming, items]);

  useEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    previousViewModeRef.current = viewMode;
    if (previousViewMode !== 'developer' && viewMode === 'developer') {
      setActiveViewIndex(Math.max(viewSlots.length - 1, 0));
    }
  }, [viewMode, viewSlots]);

  // ── Collapse listener (agent:collapseAll) ───────────────
  useEffect(() => {
    const onCollapse = () => {
      setActiveViewIndex(defaultSlotIndex(viewSlots));
    };
    window.addEventListener('agent:collapseAll', onCollapse);
    return () => window.removeEventListener('agent:collapseAll', onCollapse);
  }, [viewSlots]);

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
      .filter((e): e is Extract<SessionEvent, { type: 'session_branched' }> =>
        e.type === 'session_branched' && !!e.data.branchSessionId
      )
      .map(e => ({
        branchSessionId: e.data.branchSessionId as string,
        timestamp: e.timestamp,
      }));
  }, [allSessionEvents]);

  const parentBranch: ParentBranchInfo | undefined = useMemo(() => {
    const found = allSessionEvents.find((e): e is Extract<SessionEvent, { type: 'session_branched' }> =>
      e.type === 'session_branched' && !!e.data.parentSessionId
    );
    return found ? { parentSessionId: found.data.parentSessionId as string } : undefined;
  }, [allSessionEvents]);

  // ── Height mode per active view type ────────────────────
  // As soon as the final message content exists, the AgentMessage height
  // becomes 'auto', letting it size dynamically to the message. Otherwise,
  // it locks to 'fixed' during intermediate thought/tool streams.
  const messageItem = items.find((it) => it.type === 'message');
  const hasMessageContent = !!messageItem && (messageItem.data.message || messageItem.isStreaming);
  const heightMode = hasMessageContent ? 'auto' : 'fixed';

  // ── View title (centered in top bar, last view/messages get none) ──
  const viewTitle = useMemo(() => {
    if (isShowingDebug) return 'Agent Session Events';
    if (activeFeedback) return 'Feedback';
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
  }, [isShowingDebug, activeFeedback, activeItem]);

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
      const lastNonBranch = allSessionEvents.findLast(e => e.type !== 'session_branched');
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
    if (activeFeedback) {
      return (
        <div className="flex h-full items-center justify-center">
          <FeedbackPanel
            prompt={activeFeedback.prompt}
            actions={activeFeedback.actions}
            layout="vertical"
            onAction={(actionId) =>
              submitFeedback(activeFeedback.toolCallEventId, { action: actionId })
            }
          />
        </div>
      );
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

  const renderContent = () => {
    if (isExpanded) {
      return renderActiveView();
    }

    const activeSlotIsMessage = activeSlot?.kind === 'item' && activeSlot.item.type === 'message';

    if (!hasMessageContent) {
      return renderActiveView();
    }

    return (
      <div className="relative w-full h-full">
        {/* Underlying message drives height */}
        <div className={activeSlotIsMessage ? 'block animate-fade-in' : 'invisible pointer-events-none'}>
          {messageItem && (
            <SubViewRenderer
              item={messageItem}
              isEditMode={isEditMode}
              editingData={editingData}
              updateEditingData={updateEditingData}
              onSubmitEdit={handleSubmitEdit}
              cancelEdit={cancelEdit}
              onValidationChange={setIsValidForSubmit}
              translationContent={translationText}
            />
          )}
        </div>

        {/* Overlay matches the container's height */}
        {!activeSlotIsMessage && (
          <div className={`absolute inset-0 z-20 scrollbar-inner pr-2 ${
            isStreaming ? 'overflow-y-hidden' : 'overflow-y-auto'
          }`}>
            {renderActiveView()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-[80%] relative">
      <div
        className="session-component rounded-2xl relative bg-white dark:bg-surface-1 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] rounded-tl-md min-w-0"
        style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: agentColor }}
      >
        {/* Agent avatar — on top of bubble */}
        <AgentAvatar
          avatarImage={avatarImage}
          agentName={agentName}
          agentColor={agentColor}
          size="lg"
          className="absolute -left-5 -top-1 z-[10]"
        />

        <ComponentShell
          role="agent"
          controlBar={controlBarConfig}
          viewCount={totalViews}
          activeViewIndex={clampedIndex}
          onNavigate={setActiveViewIndex}
          branches={branches}
          parentBranch={parentBranch}
          onLoadSession={loadSession}
          onSetPreserveScroll={setPreserveScrollOnSessionChange}
          isStreaming={isStreaming ?? false}
          viewTitle={viewTitle}
          streamingStatus={streamingStatus}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(f => !f)}
          showExpandButton={true}
          avatarImage={avatarImage}
          agentName={agentName}
          agentColor={agentColor}
        >
          {isExpanded ? (
            renderContent()
          ) : heightMode === 'fixed' ? (
            <div className="px-4 pt-8 pb-4" style={{ height: 240 }}>
              <div className={`h-full scrollbar-inner ${isStreaming ? 'overflow-hidden' : 'overflow-auto'}`}>
                {renderContent()}
              </div>
            </div>
          ) : (
            <div className="px-4 py-8">
              {renderContent()}
            </div>
          )}
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
  item: SessionComponent;
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
  cancelEdit: _cancelEdit,
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

/** Default slot index: prefer pending feedback > last message item > last slot. */
function defaultSlotIndex(slots: ViewSlot[]): number {
  if (slots.length === 0) return 0;
  // Pending feedback wins — it's user-actionable.
  const feedbackIdx = slots.findIndex((s) => s.kind === 'feedback');
  if (feedbackIdx !== -1) return feedbackIdx;
  // Otherwise the last message item (the response).
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (s.kind === 'item' && s.item.type === 'message') return i;
  }
  return slots.length - 1;
}
