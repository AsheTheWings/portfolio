'use client';

/**
 * DebugView - Panel component that displays session events as JSON
 * Used inside ControlsProvider as a toggleable panel
 */

import React, { useMemo, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { CopyButton } from '@/features/shared/components/shadcn/copy-button';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

import type { AgentSessionEvent } from '../types';
import { useChatClickAway } from '../hooks/useChatClickAway';

hljs.registerLanguage('json', json);

/**
 * Truncate base64 image data in events for readable debug display
 */
function truncateImageData(events: AgentSessionEvent[]): AgentSessionEvent[] {
  return events.map(event => {
    if (event.type !== 'user-turn-completed') return event;
    
    const data = event.data as any;
    if (!data.encodedImages?.length) return event;
    
    return {
      ...event,
      data: {
        ...data,
        encodedImages: data.encodedImages.map((img: { mimeType: string; data: string }) => ({
          mimeType: img.mimeType,
          data: img.data.slice(0, 100) + '...[truncated]',
        })),
      },
    };
  });
}

interface DebugViewProps {
  sessionEvents?: AgentSessionEvent[];
  onClose: () => void;
}

export function DebugView({
  sessionEvents,
  onClose,
}: DebugViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useChatClickAway(containerRef, { mode: 'debug', enabled: true, onClickAway: onClose });
  // Highlighted JSON for debug events (with truncated image data)
  const highlightedJson = useMemo(() => {
    if (!sessionEvents || sessionEvents.length === 0) return null;
    const truncatedEvents = truncateImageData(sessionEvents);
    const jsonString = JSON.stringify(truncatedEvents, null, 2);
    return hljs.highlight(jsonString, { language: 'json' }).value;
  }, [sessionEvents]);

  return (
    <div ref={containerRef} className="session-component rounded-lg dark:border-border-subtle bg-white dark:bg-surface-1 text-foreground">
      {/* Header */}
      <div className="border-b border-foreground px-4 py-2 flex items-center">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-inherit hover:opacity-80 transition-opacity"
        >
          <ArrowUp className="w-4 h-4" />
          <span>Back</span>
        </button>
        
        <div className="flex-1 text-center text-sm font-medium text-inherit">
          Agent Session Events
        </div>
        
        {sessionEvents && sessionEvents.length > 0 && (
          <CopyButton
            content={JSON.stringify(sessionEvents, null, 2)}
            variant="ghost"
            size="sm"
            className="text-inherit hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          />
        )}
      </div>

      {/* JSON display */}
      <div className="overflow-auto scrollbar-inner my-1" style={{ height: '400px' }}>
        {!sessionEvents || sessionEvents.length === 0 ? (
          <div className="px-8 text-center text-sm text-muted-foreground">
            No events recorded
          </div>
        ) : (
          <pre className="json-highlight text-xs font-mono whitespace-pre-wrap px-4">
            <code
              className="hljs language-json"
              style={{ background: 'transparent' }}
              dangerouslySetInnerHTML={{ __html: highlightedJson || '' }}
            />
          </pre>
        )}
      </div>
    </div>
  );
}
