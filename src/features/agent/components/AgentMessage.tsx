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
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { ComponentShell } from './ComponentShell';
import type { BranchInfo, ParentBranchInfo } from './ComponentShell';
import { useAgentStore } from '../stores/useAgentStore';
import { useAgentSessionBranching } from '../hooks/useAgentSessionBranching';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import { useAgentCall } from '../hooks/useAgentCall';
import type { AgentSessionComponent, AgentSessionEvent, EditingData, FeedbackAction } from '../types';
import { Avatar, AvatarImage, AvatarFallback } from '@/features/shared/components/shadcn';
import { getAgentStatus, statusLabel } from '../utils/agent-status';

// ────────────────────────────────────────────────────────────
// View slots — discriminated union of carousel views
// ────────────────────────────────────────────────────────────

type ViewSlot =
  | { kind: 'debug' }
  | { kind: 'item'; item: AgentSessionComponent }
  | { kind: 'feedback'; toolCallEventId: string; prompt: string; actions: FeedbackAction[] }
  | { kind: 'resume' };

// ── Static action list for the paused-resume panel ──────────
const RESUME_ACTIONS: FeedbackAction[] = [
  { id: 'resume', label: 'Resume', primary: true, icon: 'Play' },
];

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
  const { submitEdit, revertToComponent } = useAgentSessionBranching();
  const { loadAgentSession } = useAgentSessionLifecycle();
  const { submitFeedback, resumeAgent } = useAgentCall();

  // ── Session events (aggregated from items + composite) ──
  const allSessionEvents = useMemo<AgentSessionEvent[]>(() => {
    const seen = new Set<string>();
    const events: AgentSessionEvent[] = [];
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

  // ── 'paused' guard: only show resume slot on the last composite for this agent ──
  const isLastForMyAgent = useAgentStore((s) => {
    const effectiveAgentId = agentId ?? 'none';
    const last = s.sessionComponents.findLast(
      (c) =>
        c.type === 'agent-message' &&
        ((c.data?.agentId as string | undefined) ?? 'none') === effectiveAgentId,
    );
    return last?.id === id;
  });

  // ── Build view slots ────────────────────────────────────
  // Slot order: [debug?] then for each item: the item (filtered for user mode)
  // followed by a synthesized feedback slot when the item is a tool-call with
  // pending userActions (toolEffects.userActions present and no matching
  // user-feedback-result event yet).
  // If the agent is paused and this is the last composite for it, a 'resume'
  // slot is appended at the end.
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
      // Filter for user mode — keep only message items, plus feedback views
      // (tool-calls themselves are hidden but their feedback surface remains).
      if (!isUserMode || it.type === 'message') {
        slots.push({ kind: 'item', item: it });
      }
      if (pending) {
        slots.push({
          kind: 'feedback',
          toolCallEventId: it.id,
          prompt: pending.prompt,
          actions: pending.actions,
        });
      }
    }
    if (agentStatus === 'paused' && isLastForMyAgent) {
      slots.push({ kind: 'resume' });
    }
    return slots;
  }, [items, isUserMode, hasDebugView, allSessionEvents, agentStatus, isLastForMyAgent]);

  const totalViews = viewSlots.length;

  // ── View state ──────────────────────────────────────────
  const [activeViewIndex, setActiveViewIndex] = useState(() => defaultSlotIndex(viewSlots));

  // ── Active slot ─────────────────────────────────────────
  const clampedIndex = Math.min(activeViewIndex, Math.max(totalViews - 1, 0));
  const activeSlot: ViewSlot | undefined = viewSlots[clampedIndex];
  const isShowingDebug = activeSlot?.kind === 'debug';
  const activeItem = activeSlot?.kind === 'item' ? activeSlot.item : undefined;
  const activeFeedback = activeSlot?.kind === 'feedback' ? activeSlot : undefined;
  const isActiveResume = activeSlot?.kind === 'resume';

  // ── Determine if active item is being edited ────────────
  const isEditMode = !!activeItem && editingEventId === activeItem.id;
  const [isValidForSubmit, setIsValidForSubmit] = useState(true);

  // ── Auto-advance: prefer pending feedback > resume > streaming tail ──
  // Track which feedback slots we've already auto-advanced to so that
  // dismissing/navigating away does not bounce the user back.
  const advancedFeedbacksRef = useRef<Set<string>>(new Set());
  const hasAutoAdvancedToResumeRef = useRef(false);

  // Reset the resume auto-advance flag when the agent leaves 'paused'.
  useEffect(() => {
    if (agentStatus !== 'paused') {
      hasAutoAdvancedToResumeRef.current = false;
    }
  }, [agentStatus]);

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
    // 2. Agent paused → jump to resume slot once.
    const resumeIdx = viewSlots.findIndex((s) => s.kind === 'resume');
    if (resumeIdx !== -1 && !hasAutoAdvancedToResumeRef.current) {
      hasAutoAdvancedToResumeRef.current = true;
      setActiveViewIndex(resumeIdx);
      return;
    }
    // 3. Streaming → advance to the last item slot.
    if (isStreaming) {
      const lastItemIdx = viewSlots.findLastIndex((s) => s.kind === 'item');
      if (lastItemIdx !== -1) setActiveViewIndex(lastItemIdx);
    }
  }, [viewSlots, isStreaming]);

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
  // Only the message view is content-sized; everything else (debug,
  // thoughts, tool-call, feedback) is fixed-height per ComponentShell.
  const heightMode =
    activeSlot?.kind === 'item' && activeSlot.item.type === 'message' ? 'auto' : 'fixed';

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
    if (isActiveResume) {
      return (
        <div className="flex h-full items-center justify-center">
          <FeedbackPanel
            prompt="Agent is paused"
            actions={RESUME_ACTIONS}
            layout="horizontal"
            stackPrompt
            onAction={resumeAgent}
          />
        </div>
      );
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

  return (
    <div className="w-[80%] relative">
      <div
        className="session-component rounded-2xl relative bg-white dark:bg-surface-1 text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)] rounded-tl-md min-w-0"
        style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: agentColor }}
      >
        {/* Agent avatar — on top of bubble */}
        <Avatar size="lg" className="absolute -left-5 -top-1 z-[10]">
          {avatarImage && <AvatarImage src={avatarImage} alt={agentName} />}
          <AvatarFallback color={agentColor} className="text-xs font-bold">
            {agentName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

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

