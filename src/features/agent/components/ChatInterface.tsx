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

import React, { useRef } from 'react';
import { useAgent } from '../hooks/useAgent';
import { InteractionArea } from './InteractionArea';
import type { MessageInputRef } from './MessageInput';
import { UserMessage } from './UserMessage';
import { AgentMessage } from './AgentMessage';
import { UserFeedback } from './UserFeedback';
import { resolveSystemPanel } from './ComponentResolver';
import { useChatScroll } from '../hooks/useChatScroll';
import { SystemCall } from '../tools/system-call';
import { isTextFeedback } from '../utils/toAgentSessionComponent';

export function ChatInterface() {
  const {
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
    ephemeral,
  } = useAgent();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputRef>(null);

  const { isAutoScrollEnabled, showAutoScrollNotification } = useChatScroll({
    scrollContainerRef,
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
  });

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat Container - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-container interface-scroll-container">
        {/* 3-Column Grid: Left Panel | Chat | Right Panel */}
        <div className="grid grid-cols-[1fr_60vw_1fr] min-h-full">
          {/* Left Panel - Portal target for agent-side content */}
          <div id="chat-left-panel" className="relative" />
          
          {/* Center - Chat Content */}
          <div className="flex flex-col gap-4 py-4 pb-8">
            {/* Placeholder when no conversation exists */}
            {sessionComponents.length === 0 && !currentSessionId && (
              <p className="w-full flex-1 flex justify-center items-center text-sm text-muted-foreground italic">
                {!ephemeral ? 'Send a message to start a conversation' : 'Waiting for your message...'}
              </p>
            )}
            
            {sessionComponents.map((component, idx) => {
              // Apply min-height to the last user-initiated group
              // Check if this is a user-message AND there are no more user-messages after it
              const isLastUserMessage = component.type === 'user-message' &&
                !sessionComponents.slice(idx + 1).some(c => c.type === 'user-message');
              
              switch (component.type) {
                case 'user-message':
                  return (
                    <div key={component.id} id={component.id} className={`w-full ${isLastUserMessage ? 'min-h-[90vh]' : ''}`}>
                      <UserMessage component={component} />
                    </div>
                  );
                case 'agent-message':
                  return (
                    <div key={component.id} id={component.id} className="w-full">
                      <AgentMessage component={component} />
                    </div>
                  );
                case 'user-feedback':
                  return (
                    <div key={component.id} id={component.id} className="w-full">
                      <UserFeedback feedback={isTextFeedback(component.data.result) ? component.data.result.userFeedback : ''} />
                    </div>
                  );
                case 'system-call':
                  return (
                    <div key={component.id} id={component.id} className="w-full">
                      <SystemCall data={component.data} />
                    </div>
                  );
                case 'config-panel':
                case 'settings-panel':
                case 'history-panel':
                case 'asset-picker-panel':
                  return (
                    <div key={component.id} id={component.id} className="w-full flex justify-center py-2">
                      {resolveSystemPanel(component.type)}
                    </div>
                  );
                default:
                  return null;
              }
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
