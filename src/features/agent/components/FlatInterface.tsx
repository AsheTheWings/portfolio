'use client';

/**
 * FlatInterface — Linear stream rendering for flat-mode derived components
 *
 * Each event produces a standalone component (no composites). Simpler layout
 * than ChatInterface — single-column, no min-height groups, no 3-column grid.
 * Has its own scroll container and InteractionArea overlay.
 *
 * Renders: user-message, message, agent-thoughts, tool-call, user-feedback,
 * system-call, and system panels.
 */

import React, { useRef } from 'react';
import { useAgent } from '../hooks/useAgent';
import { InteractionArea } from './InteractionArea';
import type { MessageInputRef } from './MessageInput';
import { UserMessage } from './UserMessage';
import { UserFeedback } from './UserFeedback';
import { AgentThoughts } from './AgentThoughts';
import { ToolCall } from './ToolCall';
import { MarkdownContent } from './MarkdownContent';
import { resolveSystemPanel } from './ComponentResolver';
import { useChatScroll } from '../hooks/useChatScroll';
import { SystemCall } from '../tools/system-call';
import { isTextFeedback } from '../utils/toAgentSessionComponent';

export function FlatInterface() {
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
      {/* Scrollable Stream */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-container interface-scroll-container">
        <div className="max-w-4xl mx-auto px-4 py-4 pb-8 flex flex-col gap-3">
          {/* Placeholder when no conversation exists */}
          {sessionComponents.length === 0 && !currentSessionId && (
            <p className="w-full flex-1 flex justify-center items-center text-sm text-muted-foreground italic">
              {!ephemeral ? 'Send a message to start a conversation' : 'Waiting for your message...'}
            </p>
          )}

          {sessionComponents.map((component) => {
            switch (component.type) {
              case 'user-message':
                return (
                  <div key={component.id} id={component.id} className="w-full">
                    <UserMessage component={component} />
                  </div>
                );
              case 'message':
                // Standalone agent message in flat mode
                return (
                  <div key={component.id} id={component.id} className="w-full">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <MarkdownContent content={component.data.message ?? ''} />
                    </div>
                  </div>
                );
              case 'agent-thoughts':
                return (
                  <div key={component.id} id={component.id} className="w-full">
                    <AgentThoughts maxLines={6} />
                  </div>
                );
              case 'tool-call':
                return (
                  <div key={component.id} id={component.id} className="w-full">
                    <ToolCall />
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
                  <div key={component.id} id={component.id} className="w-full">
                    {resolveSystemPanel(component.type)}
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>

        {/* InteractionArea - always visible at bottom of scroll viewport */}
        <div className="absolute px-auto w-full bottom-8 z-10 pointer-events-none">
          <InteractionArea ref={messageInputRef} />
        </div>
      </div>

      {/* Autoscroll Notification */}
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
