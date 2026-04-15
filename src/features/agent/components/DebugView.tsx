'use client';

/**
 * DebugView - Renders session events as syntax-highlighted JSON
 * Pure content view — no chrome, no buttons, no special behavior.
 * Used as a carousel view inside AgentMessage and UserMessage.
 */

import React, { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

import type { AgentSessionEvent } from '../types';

hljs.registerLanguage('json', json);

/**
 * Truncate base64 image data in events for readable debug display
 */
function truncateImageData(events: AgentSessionEvent[]): AgentSessionEvent[] {
  return events.map(event => {
    if (event.type !== 'user-turn-completed') return event;
    
    const { data } = event;
    if (!data.encodedImages?.length) return event;
    
    return {
      ...event,
      data: {
        ...data,
        encodedImages: data.encodedImages.map((img) => ({
          mimeType: img.mimeType,
          data: img.data.slice(0, 100) + '...[truncated]',
        })),
      },
    };
  });
}

interface DebugViewProps {
  sessionEvents?: AgentSessionEvent[];
}

export function DebugView({ sessionEvents }: DebugViewProps) {
  const highlightedJson = useMemo(() => {
    if (!sessionEvents || sessionEvents.length === 0) return null;
    const truncatedEvents = truncateImageData(sessionEvents);
    const jsonString = JSON.stringify(truncatedEvents, null, 2);
    return hljs.highlight(jsonString, { language: 'json' }).value;
  }, [sessionEvents]);

  if (!sessionEvents || sessionEvents.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        No events recorded
      </div>
    );
  }

  return (
    <pre className="json-highlight text-xs font-mono whitespace-pre-wrap">
      <code
        className="hljs language-json"
        style={{ background: 'transparent' }}
        dangerouslySetInnerHTML={{ __html: highlightedJson || '' }}
      />
    </pre>
  );
}
