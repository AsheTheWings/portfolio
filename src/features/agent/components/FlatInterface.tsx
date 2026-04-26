'use client';

/**
 * FlatInterface — Linear stream rendering for flat-mode derived components
 *
 * Each event produces a standalone component (no composites). Simpler layout
 * than ChatInterface — single-column, no min-height groups, no 3-column grid.
 * Has its own scroll container and InteractionArea overlay.
 *
 * agent-thoughts and tool-call types are wrapped in CollapsibleShip
 * for expand/collapse behavior. All other types render directly via
 * the centralized resolveComponent.
 */

import React, { useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { InteractionArea } from './InteractionArea';
import type { MessageInputRef } from './MessageInput';
import type { AgentSessionComponent } from '../types';
import { resolveComponent } from './ComponentResolver';
import { CollapsibleShip } from './CollapsibleShip';
import { getToolDisplayName, getToolStatus } from '../utils/tool-call';
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { useChatScroll } from '../hooks/useChatScroll';

// ── Ship header builders for collapsible types ──────────────────

function ThoughtsShipHeader({ isStreaming }: { isStreaming?: boolean }) {
  return (
    <>
      <span className="font-medium">Thinking</span>
      {isStreaming && <ThreeDotsScaleMiddleIcon size={16} className="text-cyan-500" />}
    </>
  );
}

function ToolCallShipHeader({ data }: { data: AgentSessionComponent['data'] }) {
  const status = getToolStatus(data);
  return (
    <>
      <span className="font-medium">{getToolDisplayName(data)}</span>
      {status === 'executing' && <ThreeDotsScaleMiddleIcon size={14} className="text-cyan-500" />}
      {status === 'complete' && <Check size={14} className="text-cyan-500" />}
      {status === 'failed' && <X size={14} className="text-red-500" />}
    </>
  );
}

// ── Render a flat component, wrapping collapsible types with ship ──

function renderFlatComponent(component: AgentSessionComponent): React.ReactNode {
  const content = resolveComponent(component);
  if (!content) return null;

  // Wrap agent-thoughts and tool-call in CollapsibleShip
  switch (component.type) {
    case 'agent-thoughts':
      return (
        <div key={component.id} id={component.id} className="w-full">
          <CollapsibleShip
            header={<ThoughtsShipHeader isStreaming={component.isStreaming} />}
            isStreaming={component.isStreaming}
            maxHeight="12rem"
          >
            {content}
          </CollapsibleShip>
        </div>
      );
    case 'tool-call':
      return (
        <div key={component.id} id={component.id} className="w-full">
          <CollapsibleShip
            header={<ToolCallShipHeader data={component.data} />}
            maxHeight="400px"
          >
            {content}
          </CollapsibleShip>
        </div>
      );
    default:
      return (
        <div key={component.id} id={component.id} className="w-full">
          {content}
        </div>
      );
  }
}

export function FlatInterface() {
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

          {sessionComponents.map(renderFlatComponent)}
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
