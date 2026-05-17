'use client';

/**
 * CollapsibleShip — Standalone collapse/expand wrapper
 *
 * A pure layout primitive that wraps any content with a clickable header
 * that toggles visibility. Owns all collapse behavior:
 *   - Clickable header with chevron
 *   - Auto-expand after delay during streaming
 *   - Auto-collapse when streaming completes
 *   - Click-away to collapse
 *   - `agent:collapseAll` global event listener
 *
 * The wrapped component is a pure content renderer — it knows nothing
 * about collapsibility.
 */

import { useState, useRef, useEffect } from 'react';
import { useChatClickAway } from '../hooks/useChatClickAway';

interface CollapsibleShipProps {
  /** Always-visible clickable header (label, status icons, etc.) */
  header: React.ReactNode;
  /** Drives auto-expand/auto-collapse behavior */
  isStreaming?: boolean;
  /** Delay before auto-expanding during streaming (default: 300ms) */
  autoExpandDelay?: number;
  /** Max height for expanded content container */
  maxHeight?: string;
  /** Content rendered below header when expanded */
  children: React.ReactNode;
}

export function CollapsibleShip({
  header,
  isStreaming = false,
  autoExpandDelay = 300,
  maxHeight,
  children,
}: CollapsibleShipProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoCollapsed = useRef(false);
  const wasAutoExpanded = useRef(false);

  // Auto-expand after delay during streaming
  useEffect(() => {
    if (isStreaming && !isExpanded && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(true);
        wasAutoExpanded.current = true;
      }, autoExpandDelay);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isExpanded, autoExpandDelay]);

  // Auto-collapse when streaming transitions to complete (only if auto-expanded)
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

  // Global collapse listener (Escape / new user message)
  useEffect(() => {
    const onCollapseAll = () => {
      setIsExpanded(false);
      wasAutoExpanded.current = false;
    };
    window.addEventListener('agent:collapseAll', onCollapseAll as EventListener);
    return () => window.removeEventListener('agent:collapseAll', onCollapseAll as EventListener);
  }, []);

  return (
    <div ref={containerRef} className="session-component">
      {/* Clickable header — always visible */}
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
      >
        {header}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          className="mt-2 overflow-y-auto scrollbar-inner"
          style={maxHeight ? { maxHeight } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
