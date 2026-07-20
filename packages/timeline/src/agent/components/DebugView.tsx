'use client';

/**
 * DebugView - Renders session events as syntax-highlighted JSON
 * Pure content view — no chrome, no buttons, no special behavior.
 * Used as a carousel view inside AgentMessage and UserMessage.
 */

import React, { useMemo } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

import type { SessionEvent } from '../types';

hljs.registerLanguage('json', json);

interface DebugViewProps {
  sessionEvents?: SessionEvent[];
}

export function DebugView({ sessionEvents }: DebugViewProps) {
  const highlightedJson = useMemo(() => {
    if (!sessionEvents || sessionEvents.length === 0) return null;
    const jsonString = JSON.stringify(sessionEvents, null, 2);
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
