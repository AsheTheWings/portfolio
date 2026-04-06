'use client';

/**
 * Chat-Based UI - Simple chat interface
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
import type { AgentSessionComponent } from '../types';
import { useAgent } from '../hooks/useAgent';
import { InteractionArea } from './InteractionArea';
import { resolveComponent } from './ComponentResolver';
import { useChatScroll } from '../hooks/useChatScroll';

export function ChatInterface() {
  const {
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
    ephemeral,
    agentConfig,
    uiMode,
  } = useAgent();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<any>(null);

  const { isAutoScrollEnabled, showAutoScrollNotification } = useChatScroll({
    scrollContainerRef,
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
  });

  // Group components by groups (User message starts a new group)
  const componentGroups = React.useMemo(() => {
    const groups: { userComponent?: AgentSessionComponent; agentComponents: AgentSessionComponent[] }[] = [];
    let currentGroup: { userComponent?: AgentSessionComponent; agentComponents: AgentSessionComponent[] } = { agentComponents: [] };
    
    sessionComponents.forEach(c => {
      if (c.role === 'user') {
        // Push old group if it has content
        if (currentGroup.userComponent || currentGroup.agentComponents.length > 0) {
          groups.push(currentGroup);
        }
        // Start new group
        currentGroup = { userComponent: c, agentComponents: [] };
      } else {
        currentGroup.agentComponents.push(c);
      }
    });
    
    // Push final group
    if (currentGroup.userComponent || currentGroup.agentComponents.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }, [sessionComponents]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Chat Container - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-container interface-scroll-container">
        {/* 3-Column Grid: Left Panel | Chat | Right Panel */}
        <div className="grid grid-cols-[1fr_60vw_1fr] min-h-full">
          {/* Left Panel - Portal target for agent-side content */}
          <div id="chat-left-panel" className="relative lg:border-2 border-red-500" />
          
          {/* Center - Chat Content (pb-24 clears the floating InteractionArea overlay) */}
          <div className="flex flex-col gap-4 py-4 pb-8">
            {/* Placeholder when no conversation exists */}
            {sessionComponents.length === 0 && !currentSessionId && (
              <p className="w-full flex-1 flex justify-center items-center text-sm text-muted-foreground italic">
                {!ephemeral ? 'Send a message to start a conversation' : 'Waiting for your message...'}
              </p>
            )}
            
            {componentGroups.map((group, idx) => {
              const isLastGroup = idx === componentGroups.length - 1;
              // Apply min-height if it's the last group AND it was initiated by a user
              // This reserves space for the agent to fill, keeping the user message at the top
              const useMinHeight = isLastGroup && group.userComponent;
              const minHeightClass = useMinHeight ? 'min-h-[90vh]' : '';
              
              const userComp = group.userComponent;
              const renderedUser = userComp ? resolveComponent(userComp, {
                mode: 'chat',
                includeThoughtsInResponse: agentConfig?.includeThoughtsInResponse ?? true,
              }) : null;

              return (
                <div key={idx} className={`flex flex-col gap-4 ${minHeightClass}`}>
                  {/* User Message (Header of the group) */}
                  {renderedUser && userComp && (
                    <div key={userComp.id} id={userComp.id} className="w-full">
                      {renderedUser}
                    </div>
                  )}
                  
                  {/* Agent Responses (Body of the group) */}
                  <div className="flex flex-col gap-4 w-full transition-all duration-200">
                    {group.agentComponents.map((component) => {
                      const rendered = resolveComponent(component, {
                        mode: 'chat',
                        includeThoughtsInResponse: agentConfig?.includeThoughtsInResponse ?? true,
                      });
                      return rendered ? (
                        <div key={component.id} id={component.id} className="w-full">
                          {rendered}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Right Panel - Portal target for user-side content */}
          <div id="chat-right-panel" className="relative border-2 border-red-500" />
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
