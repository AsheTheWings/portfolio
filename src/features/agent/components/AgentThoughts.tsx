'use client';

/**
 * AgentThoughts - Collapsible thoughts display
 * Shows model's thinking process during generation
 * 
 * Behavior:
 * - Stream mode: Auto-expands after 300ms, shows full accumulated thoughts with auto-scroll, auto-collapses when complete
 * - Non-stream mode: Starts collapsed, user can expand to view full thoughts
 */

import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';
import { ThreeDotsScaleMiddleIcon } from '@/features/shared/icons/ThreeDotsScaleMiddleIcon';
import { useChatClickAway } from '../hooks/useChatClickAway';
import { useAgentSessionComponent } from '../contexts/AgentSessionComponentContext';

interface AgentThoughtsProps {
  maxLines?: number;
}

export function AgentThoughts({ maxLines = 6 }: AgentThoughtsProps) {
  const { data, isStreaming } = useAgentSessionComponent();
  const thoughts = data.thoughts || '';
  
  const [isExpanded, setIsExpanded] = useState(false);
  const thoughtsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoCollapsed = useRef(false);
  const wasAutoExpanded = useRef(false);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && isExpanded && thoughtsRef.current) {
      thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
    }
  }, [thoughts, isStreaming, isExpanded]);

  // Debounced auto-expand: only expand after 300ms of streaming
  useEffect(() => {
    if (isStreaming && !isExpanded && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(true);
        wasAutoExpanded.current = true;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isExpanded]);

  // Auto-collapse when streaming transitions to complete (only if it was auto-expanded)
  useEffect(() => {
    if (!isStreaming && isExpanded && wasAutoExpanded.current && !hasAutoCollapsed.current) {
      hasAutoCollapsed.current = true;
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isExpanded]);

  // Click outside to collapse
  useChatClickAway(containerRef, {
    mode: 'expansion',
    enabled: isExpanded,
    disabled: false,
    onClickAway: () => {
      setIsExpanded(false);
      wasAutoExpanded.current = false;
    },
  });

  // Global collapse listener (Escape)
  useEffect(() => {
    const onCollapseAll = () => {
      setIsExpanded(false);
      wasAutoExpanded.current = false;
    };
    window.addEventListener('agent:collapseAll', onCollapseAll as EventListener);
    return () => window.removeEventListener('agent:collapseAll', onCollapseAll as EventListener);
  }, []);

  if (!thoughts) return null;

  return (
    <div ref={containerRef} className="session-component">
      {/* Thinking Label - Clickable */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
          if (!isExpanded) {
            wasAutoExpanded.current = false;
          }
        }}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Hide thoughts' : 'Show thoughts'}
      >
        <span className="font-medium">Thinking</span>
        {isStreaming && <ThreeDotsScaleMiddleIcon size={16} className="text-cyan-500" />}
        {!isStreaming && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Thoughts Content - Expandable */}
      {isExpanded && (
        <div className="relative mt-2">
          <div
            ref={thoughtsRef}
            className="
              py-2 pr-2
              overflow-y-auto 
              text-xs
              text-muted-foreground 
              font-mono
              leading-relaxed
              scrollbar-hide
              scrollbar-inner
            "
            style={{
              maxHeight: `${maxLines * 1.5}rem`,
            }}
          >
          {isStreaming ? (
            // Plain text during streaming: avoids O(n) markdown re-parsing on every token
            <div className="whitespace-pre-wrap">{thoughts}</div>
          ) : (
            <Markdown
              options={{
                forceBlock: true,
                overrides: {
                  p: {
                    props: {
                      className: 'mb-1 last:mb-0',
                    },
                  },
                  code: {
                    props: {
                      className: 'bg-muted/50 px-1 rounded text-[11px]',
                    },
                  },
                  pre: {
                    props: {
                      className: 'bg-muted/50 p-2 rounded my-1 overflow-x-auto text-[11px]',
                    },
                  },
                  ul: {
                    props: {
                      className: 'list-disc list-inside my-1 space-y-0.5',
                    },
                  },
                  ol: {
                    props: {
                      className: 'list-decimal list-inside my-1 space-y-0.5',
                    },
                  },
                },
              }}
            >
              {thoughts}
            </Markdown>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
