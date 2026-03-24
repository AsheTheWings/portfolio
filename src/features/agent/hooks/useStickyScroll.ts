import { useEffect, useRef, useCallback } from 'react';

/**
 * useStickyScroll - Base hook for sticky-to-bottom scroll behavior
 * 
 * Behavior:
 * - Initially sticky (auto-scrolls to bottom)
 * - User scrolls up → disables sticky mode
 * - User returns to bottom → re-enables sticky mode
 * - Content changes while sticky → scrolls to bottom
 */

interface UseStickyScrollOptions {
  /** Threshold in pixels to consider "at bottom" (default: 50) */
  threshold?: number;
}

interface UseStickyScrollReturn {
  /** Ref to attach to scroll container */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Manually scroll to bottom */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Check if currently in sticky mode */
  isStickyMode: () => boolean;
  /** Programmatically scroll (marks as non-user scroll) */
  scrollTo: (options: { top?: number; behavior?: ScrollBehavior }) => void;
  /** Refs for external access */
  refs: React.MutableRefObject<{
    isAtBottom: boolean;
    isStickyMode: boolean;
    isProgrammaticScroll: boolean;
    lastScrollTop: number;
  }>;
}

export function useStickyScroll(
  contentDependency: unknown,
  options: UseStickyScrollOptions = {}
): UseStickyScrollReturn {
  const { threshold = 50 } = options;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const refs = useRef({
    isAtBottom: true,
    isStickyMode: true,
    isProgrammaticScroll: false,
    lastScrollTop: 0,
  });

  // Programmatic scroll helper
  const scrollTo = useCallback((scrollOptions: { top?: number; behavior?: ScrollBehavior }) => {
    const container = scrollRef.current;
    if (!container) return;
    refs.current.isProgrammaticScroll = true;
    container.scrollTo(scrollOptions);
    requestAnimationFrame(() => {
      refs.current.isProgrammaticScroll = false;
    });
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollRef.current;
    if (!container) return;
    refs.current.isAtBottom = true;
    refs.current.isStickyMode = true;
    scrollTo({ top: container.scrollHeight, behavior });
  }, [scrollTo]);

  // Check if at bottom
  const isAtBottomCheck = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }, [threshold]);

  // Track user scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (refs.current.isProgrammaticScroll) return;

      const currentScrollTop = container.scrollTop;
      const wasScrollingUp = currentScrollTop < refs.current.lastScrollTop;
      refs.current.lastScrollTop = currentScrollTop;

      if (wasScrollingUp) {
        refs.current.isAtBottom = false;
        refs.current.isStickyMode = false;
      } else {
        refs.current.isAtBottom = isAtBottomCheck();
        if (refs.current.isAtBottom) {
          refs.current.isStickyMode = true;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAtBottomCheck]);

  // Auto-scroll when content changes and sticky
  useEffect(() => {
    if (refs.current.isStickyMode) {
      scrollToBottom();
    }
  }, [contentDependency, scrollToBottom]);

  return {
    scrollRef,
    scrollToBottom,
    isStickyMode: () => refs.current.isStickyMode,
    scrollTo,
    refs,
  };
}
