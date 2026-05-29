'use client';

/**
 * AgentThoughts — Pure content renderer for model thinking
 *
 * Renders thoughts text as markdown (or plain text during streaming).
 * Has NO collapse/expand behavior — that's handled by CollapsibleShip
 * when needed (e.g., in FlatInterface).
 */

import React, { useRef, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';
import { ThreeDotsScaleMiddleIcon } from '@portfolio/ui/icons/ThreeDotsScaleMiddleIcon';

interface AgentThoughtsProps {
  thoughts?: string;
  isStreaming?: boolean;
}

export function AgentThoughts({ thoughts, isStreaming }: AgentThoughtsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isStreaming]);

  if (!thoughts && !isStreaming) return null;

  // Streaming with no content yet — show spinner
  if (!thoughts) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <ThreeDotsScaleMiddleIcon size={16} className="text-cyan-500" />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`h-full py-2 pr-2 text-xs text-muted-foreground font-mono leading-relaxed scrollbar-hide scrollbar-inner ${
        isStreaming ? 'overflow-y-hidden' : 'overflow-y-auto'
      }`}
      style={isStreaming ? {
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20px)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 20px)',
      } : undefined}
    >
      {isStreaming ? (
        <div className="whitespace-pre-wrap">{thoughts}</div>
      ) : (
        <Markdown
          options={{
            forceBlock: true,
            overrides: {
              p: { props: { className: 'mb-1 last:mb-0' } },
              code: { props: { className: 'bg-muted/50 px-1 rounded text-[11px]' } },
              pre: { props: { className: 'bg-muted/50 p-2 rounded my-1 overflow-x-auto text-[11px]' } },
              ul: { props: { className: 'list-disc list-inside my-1 space-y-0.5' } },
              ol: { props: { className: 'list-decimal list-inside my-1 space-y-0.5' } },
            },
          }}
        >
          {thoughts}
        </Markdown>
      )}
    </div>
  );
}
