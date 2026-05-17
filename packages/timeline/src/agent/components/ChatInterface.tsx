'use client';

/**
 * Chat-Based UI - Chat interface rendering chat-mode derived components
 * 
 * Renders sessionComponents directly — the store's chat derivation already
 * produces the right composites (user-message, agent-message, user-feedback,
 * system panels). No grouping useMemo needed.
 * 
 * SCROLL BEHAVIOR:
 * - Session load: Scroll to last user component (top of viewport)
 * - User messages: Scroll so the message's top edge is near the top of the viewport
 * - System messages: Scroll to show the panel (block: 'start')
 * - Agent messages: No auto-scrolling during streaming
 * - Targeted scroll: Navigation feature for clicking on session items
 * - Branch navigation: Preserve scroll position
 */

import React, { useRef, useMemo } from 'react';
import type { SessionComponent } from '../types';
import { useAgent } from '../hooks/useAgent';
import { InteractionArea } from './InteractionArea';
import type { MessageInputRef } from './MessageInput';
import { resolveComponent } from './ComponentResolver';
import { useChatScroll } from '../hooks/useChatScroll';

// ── Render a single component via centralized resolver ──────────
function renderComponent(component: SessionComponent): React.ReactNode {
  const content = resolveComponent(component);
  if (!content) return null;

  // System panels get centered layout
  const isPanel = component.type === 'config-panel' || component.type === 'settings-panel'
    || component.type === 'history-panel' || component.type === 'asset-picker-panel'
    || component.type === 'resume-workflow';

  return (
    <div key={component.id} id={component.id} className={isPanel ? 'w-full flex justify-center py-2' : 'w-full'}>
      {content}
    </div>
  );
}

// ── Group components into user-initiated conversation groups ──
// A user-message starts a new group; subsequent non-user components
// belong to it. min-h-[90vh] on the last group keeps the user message
// at the top of the viewport while the agent response fills below.
interface ComponentGroup {
  userComponent?: SessionComponent;
  responseComponents: SessionComponent[];
}

function groupComponents(components: SessionComponent[]): ComponentGroup[] {
  const groups: ComponentGroup[] = [];
  let current: ComponentGroup = { responseComponents: [] };

  for (const c of components) {
    if (c.type === 'user-message') {
      // Push previous group if it has content
      if (current.userComponent || current.responseComponents.length > 0) {
        groups.push(current);
      }
      current = { userComponent: c, responseComponents: [] };
    } else {
      current.responseComponents.push(c);
    }
  }

  // Push final group
  if (current.userComponent || current.responseComponents.length > 0) {
    groups.push(current);
  }

  return groups;
}

export function ChatInterface() {
  const {
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
    ephemeral,
  } = useAgent();

  // sessionComponents already includes the staged developer-mode preview
  // (managed by the store, mirroring the system-panel pattern).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputRef>(null);

  const { isAutoScrollEnabled, showAutoScrollNotification } = useChatScroll({
    scrollContainerRef,
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
  });

  const componentGroups = useMemo(() => groupComponents(sessionComponents), [sessionComponents]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat Container - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-container interface-scroll-container">
        {/* 3-Column Grid: Left Panel | Chat | Right Panel */}
        <div className="grid grid-cols-[1fr_60vw_1fr] min-h-full">
          {/* Left Panel - Portal target for agent-side content */}
          <div id="chat-left-panel" className="relative" />
          
          {/* Center - Chat Content */}
          <div className="flex flex-col gap-6 pt-4 pb-8">
            {/* Placeholder when no conversation exists */}
            {sessionComponents.length === 0 && !currentSessionId && (
              <p className="w-full flex-1 flex justify-center items-center text-sm text-muted-foreground italic">
                {!ephemeral ? 'Send a message to start a conversation' : 'Waiting for your message...'}
              </p>
            )}
            
            {componentGroups.map((group, idx) => {
              const isLastGroup = idx === componentGroups.length - 1;
              const useMinHeight = isLastGroup && !!group.userComponent;

              return (
                <div key={group.userComponent?.id ?? `group-${idx}`} className={`flex flex-col gap-6 ${useMinHeight ? 'min-h-[calc(100vh-42px-3rem)]' : ''}`}>
                  {group.userComponent && renderComponent(group.userComponent)}
                  {group.responseComponents.map(c => renderComponent(c))}
                </div>
              );
            })}
          </div>
          
          {/* Right Panel - Portal target for user-side content */}
          <div id="chat-right-panel" className="relative" />
        </div>
        {/* InteractionArea - always visible at bottom of scroll viewport */}
        <div className="absolute px-auto w-full bottom-8 z-10 pointer-events-none">
          <InteractionArea
            ref={messageInputRef}
          />
        </div>
      </div>

      {/* Autoscroll Notification - bottom right corner */}
      {showAutoScrollNotification && (
        <div className="absolute bottom-6 left-6 flex justify-center items-center">
          <div className="text-xl font-black tracking-tighter px-3 py-2" style={{ fontFamily: '"Courier New", "IBM Plex Mono", "Roboto Mono", monospace', letterSpacing: '0.05em', opacity: 0.8 }}>
            {isAutoScrollEnabled ? 'AUTOSCROLL ON' : 'AUTOSCROLL OFF'}
          </div>
        </div>
      )}

    </div>
  );
}
