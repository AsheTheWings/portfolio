import { useEffect, useRef, useState, useCallback } from 'react';
import { AgentSessionComponent } from '../types';

/**
 * SCROLL BEHAVIORS:
 * 1. Session Load         → Instant scroll to bottom
 * 2. Explicit Navigation  → System: smooth to top | Other: instant to element
 * 3. New User Message     → Smooth scroll to message top
 * 4. New System Panel     → Smooth scroll to panel top
 * 5. New Agent Message    → If at bottom & auto-scroll: smooth to bottom
 * 6. Streaming Content    → If at bottom & auto-scroll: instant stick-to-bottom
 * 7. User Scrolls Up      → Disable stick-to-bottom until return to bottom
 * 
 * Uses useStickyScroll as base for core sticky behavior.
 */

interface UseChatScrollProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  sessionComponents: AgentSessionComponent[];
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
  // Only state that affects UI rendering
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showAutoScrollNotification, setShowAutoScrollNotification] = useState(false);

  // Tracking refs for chat-specific logic
  const chatRefs = useRef({
    lastSessionId: null as string | null,
    lastComponentCount: 0,
  });

  // Core sticky scroll refs
  const stickyRefs = useRef({
    lastScrollTop: 0,
    isAtBottom: true,
    isStickyMode: true,
    isProgrammaticScroll: false,
  });

  // Scroll helpers
  const scrollTo = useCallback((options: { top?: number; behavior?: ScrollBehavior }) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickyRefs.current.isProgrammaticScroll = true;
    container.scrollTo(options);
    requestAnimationFrame(() => {
      stickyRefs.current.isProgrammaticScroll = false;
    });
  }, [scrollContainerRef]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickyRefs.current.isAtBottom = true;
    stickyRefs.current.isStickyMode = true;
    scrollTo({ top: container.scrollHeight, behavior });
  }, [scrollContainerRef, scrollTo]);

  const scrollToElement = useCallback((id: string, behavior: ScrollBehavior = 'auto') => {
    stickyRefs.current.isProgrammaticScroll = true;
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior, block: 'start' });
      }
      setTimeout(() => {
        stickyRefs.current.isProgrammaticScroll = false;
      }, behavior === 'smooth' ? 500 : 50);
    });
  }, []);

  const isAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= 50;
  }, [scrollContainerRef]);

  // Track user scroll position (ref-only, no state updates)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (stickyRefs.current.isProgrammaticScroll) return;

      const currentScrollTop = container.scrollTop;
      const wasScrollingUp = currentScrollTop < stickyRefs.current.lastScrollTop;
      stickyRefs.current.lastScrollTop = currentScrollTop;

      if (wasScrollingUp) {
        stickyRefs.current.isAtBottom = false;
        stickyRefs.current.isStickyMode = false;
      } else {
        stickyRefs.current.isAtBottom = isAtBottom();
        if (stickyRefs.current.isAtBottom) {
          stickyRefs.current.isStickyMode = true;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, isAtBottom]);

  // Keyboard shortcut (Ctrl+Alt+S)
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

  // Main scroll logic - single effect
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
    // Delay updating lastSessionId until we have components to scroll to
    if (isSessionChange) {
      if (sessionComponents.length > 0) {
        scrollToBottom('auto');
        chat.lastSessionId = currentSessionId;
        chat.lastComponentCount = sessionComponents.length;
      }
      // Don't update tracking yet if no components - wait for loadAgentSession to complete
      return;
    }
    
    // Update tracking for non-session-change cases
    chat.lastComponentCount = sessionComponents.length;

    // 3. New Content
    if (isNewContent && componentDelta > 0) {
      const lastComponent = sessionComponents[sessionComponents.length - 1];
      if (!lastComponent) return;

      // New user message → scroll to message top
      if (lastComponent.role === 'user') {
        scrollToElement(lastComponent.id, 'smooth');
        sticky.isAtBottom = true; // Re-engage auto-scroll
        return;
      }

      // New system panel → scroll to panel top
      if (lastComponent.role === 'system') {
        scrollToElement(lastComponent.id, 'smooth');
        return;
      }

      // Agent content: auto-scroll if enabled and at bottom
      if (isAutoScrollEnabled && sticky.isAtBottom) {
        // Use smooth for first message in a response, instant for streaming
        const prevComponent = sessionComponents.length > 1 ? sessionComponents[sessionComponents.length - 2] : null;
        const isFirstAgentResponse = prevComponent?.role === 'user';
        scrollToBottom(isFirstAgentResponse ? 'smooth' : 'auto');
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

  // Stick-to-bottom for streaming (uses sticky mode, not isAtBottom)
  useEffect(() => {
    if (!isAutoScrollEnabled || !stickyRefs.current.isStickyMode) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    // Keep at bottom while in sticky mode
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 5) {
      scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    }
  }, [sessionComponents, isAutoScrollEnabled, scrollContainerRef, scrollTo]);

  return {
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    showAutoScrollNotification,
  };
}
