import { useEffect, useRef, useState, useCallback } from 'react';
import { SessionComponent } from '../types';
import { useAgentStore } from '../stores/useAgentStore';

/**
 * SCROLL BEHAVIORS:
 * 1. Session Load         → Instant scroll to last user component (top of viewport)
 * 2. Explicit Navigation  → System: smooth to top | Other: instant to element
 * 3. New User Message     → Smooth scroll to message top
 * 4. New System Panel     → Smooth scroll to panel top
 * 5. New Agent Component  → Smooth scroll to bottom (first response only)
 * 6. Streaming Content    → rAF loop keeps scroll pinned to bottom
 * 7. User Scrolls Up      → Disable stick-to-bottom until return to bottom
 * 8. Branch Navigation    → Preserve scroll position (no scrolling)
 *
 * Streaming scroll architecture:
 * - Old approach: useEffect fires on every sessionComponents change (each WS chunk
 *   triggers Zustand update → re-render → useEffect → scrollTo). This caused:
 *   a) N scroll calls per second matching token throughput
 *   b) isProgrammaticScroll flag race (rAF reset could fire before/after scroll event)
 *   c) Two overlapping effects both calling scrollTo on the same render
 *
 * - New approach: A single rAF loop runs at display refresh rate (~60fps) and checks
 *   if scrollHeight grew. Completely decoupled from React render timing — collapses
 *   any number of chunk→render cycles per frame into one scroll update.
 */

interface UseChatScrollProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  sessionComponents: SessionComponent[];
  currentSessionId: string | null;
  scrollToComponentId: string | null;
  clearScrollToComponentId: () => void;
}

export function useChatScroll({
  scrollContainerRef,
  sessionComponents,
  currentSessionId,
  scrollToComponentId,
  clearScrollToComponentId,
}: UseChatScrollProps) {
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showAutoScrollNotification, setShowAutoScrollNotification] = useState(false);

  const chatRefs = useRef({
    lastSessionId: null as string | null,
    lastComponentCount: 0,
  });

  const stickyRefs = useRef({
    lastScrollTop: 0,
    isAtBottom: true,
    isStickyMode: true,
    // Timestamp-based programmatic scroll guard.
    // Scroll events before this time are treated as programmatic (skipped by handler).
    // Replaces the old boolean + rAF reset which had a race condition:
    // rAF reset could fire before scroll event arrived, causing the handler
    // to misidentify programmatic scrolls as user scrolls and exit sticky mode.
    programmaticUntil: 0,
  });

  // --- Scroll helpers ---

  const scrollTo = useCallback((options: { top?: number; behavior?: ScrollBehavior }) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickyRefs.current.programmaticUntil = Date.now() + (options.behavior === 'smooth' ? 500 : 50);
    container.scrollTo(options);
  }, [scrollContainerRef]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickyRefs.current.isAtBottom = true;
    stickyRefs.current.isStickyMode = true;
    scrollTo({ top: container.scrollHeight, behavior });
  }, [scrollContainerRef, scrollTo]);

  const scrollToElement = useCallback((id: string, behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickyRefs.current.programmaticUntil = Date.now() + (behavior === 'smooth' ? 500 : 50);
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (element) {
        // Manual scroll calculation — avoids scrollIntoView which scrolls ALL
        // ancestors (including body with overflow:hidden), causing browser to
        // reset container scroll during paint reconciliation
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetScroll = container.scrollTop + (elementRect.top - containerRect.top) - 16;
        container.scrollTo({ top: Math.max(0, targetScroll), behavior });
      }
    });
  }, [scrollContainerRef]);

  const isAtBottomCheck = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    // 2px tolerance for sub-pixel rounding — no magnetic snap zone
    return container.scrollHeight - container.scrollTop - container.clientHeight <= 2;
  }, [scrollContainerRef]);

  // --- User scroll tracking ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sticky = stickyRefs.current;

      // Skip programmatic scrolls (timestamp guard)
      if (Date.now() < sticky.programmaticUntil) {
        sticky.lastScrollTop = container.scrollTop;
        return;
      }

      const currentScrollTop = container.scrollTop;
      const wasScrollingUp = currentScrollTop < sticky.lastScrollTop;
      sticky.lastScrollTop = currentScrollTop;

      if (wasScrollingUp) {
        sticky.isAtBottom = false;
        sticky.isStickyMode = false;
      } else {
        sticky.isAtBottom = isAtBottomCheck();
        if (sticky.isAtBottom) {
          sticky.isStickyMode = true;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, isAtBottomCheck]);

  // --- rAF-coalesced sticky scroll loop ---
  // Pins scroll to bottom during streaming, independent of React render timing.
  // The rAF loop only scrolls DOWN (never up), so scroll events it generates
  // will never trigger the wasScrollingUp branch — no programmatic scroll guard needed.
  // Cost: one scrollHeight/scrollTop read per frame (~0.01ms). Negligible.
  useEffect(() => {
    if (!isAutoScrollEnabled) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number;

    const tick = () => {
      if (stickyRefs.current.isStickyMode) {
        const { scrollHeight, scrollTop, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight > 1) {
          container.scrollTop = scrollHeight - clientHeight;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoScrollEnabled, scrollContainerRef]);

  // --- Keyboard shortcut (Ctrl+Alt+S) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsAutoScrollEnabled(prev => !prev);
        setShowAutoScrollNotification(true);
        setTimeout(() => setShowAutoScrollNotification(false), 2000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Main scroll logic (discrete events only) ---
  // Handles: session load, explicit navigation, new component addition.
  // Does NOT handle streaming content growth — the rAF loop above covers that.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const chat = chatRefs.current;
    const sticky = stickyRefs.current;
    const isSessionChange = currentSessionId !== chat.lastSessionId;
    const isNewContent = sessionComponents.length > chat.lastComponentCount;
    const componentDelta = sessionComponents.length - chat.lastComponentCount;

    // 1. Explicit Navigation (takes priority)
    if (scrollToComponentId) {
      // Disable sticky mode so the rAF loop doesn't yank scroll back to bottom
      sticky.isStickyMode = false;
      sticky.isAtBottom = false;
      const target = sessionComponents.find(c => c.id === scrollToComponentId);
      if (target?.role === 'system') {
        scrollToElement(scrollToComponentId, 'smooth');
      } else {
        scrollToElement(scrollToComponentId, 'auto');
      }
      clearScrollToComponentId();
      chat.lastSessionId = currentSessionId;
      chat.lastComponentCount = sessionComponents.length;
      return;
    }

    // 2. Session Load (only when components are actually loaded)
    if (isSessionChange) {
      if (sessionComponents.length > 0) {
        const preserveScroll = useAgentStore.getState().preserveScrollOnSessionChange;
        if (preserveScroll) {
          useAgentStore.getState().setPreserveScrollOnSessionChange(false);
        } else {
          const lastUserComponent = [...sessionComponents].reverse().find(c => c.role === 'user');
          if (lastUserComponent) {
            sticky.isStickyMode = false;
            sticky.isAtBottom = false;
            scrollToElement(lastUserComponent.id, 'auto');
          } else {
            scrollToBottom('auto');
          }
        }
        chat.lastSessionId = currentSessionId;
        chat.lastComponentCount = sessionComponents.length;
      }
      return;
    }

    chat.lastComponentCount = sessionComponents.length;

    // 3. New Component Added (discrete event, not streaming content update)
    if (isNewContent && componentDelta > 0) {
      const lastComponent = sessionComponents[sessionComponents.length - 1];
      if (!lastComponent) return;

      if (lastComponent.role === 'user') {
        scrollToElement(lastComponent.id, 'smooth');
        sticky.isStickyMode = true;
        sticky.isAtBottom = true;
        return;
      }

      if (lastComponent.role === 'system') {
        scrollToElement(lastComponent.id, 'smooth');
        return;
      }

      // First agent response after user message: smooth scroll to bottom.
      // Subsequent streaming is handled by the rAF loop.
      if (isAutoScrollEnabled && sticky.isStickyMode) {
        const prevComponent = sessionComponents.length > 1 ? sessionComponents[sessionComponents.length - 2] : null;
        if (prevComponent?.role === 'user') {
          scrollToBottom('smooth');
        }
      }
    }
  }, [
    sessionComponents,
    currentSessionId,
    scrollToComponentId,
    clearScrollToComponentId,
    isAutoScrollEnabled,
    scrollContainerRef,
    scrollToBottom,
    scrollToElement,
  ]);

  return {
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    showAutoScrollNotification,
  };
}
