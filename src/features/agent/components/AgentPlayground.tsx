'use client';

/**
 * Agent Playground - Full playground implementation
 * Provides 90vw container, ToolsBar, and UI mode rendering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAgent } from '../hooks/useAgent';
import { useHydrateStore } from '../hooks/useHydrateStore';
import { useAgentSessionRouting } from '../hooks/useAgentSessionRouting';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import { useWsEventIngestion } from '../hooks/useWsEventIngestion';
import { useAgentConnection } from '../hooks/useAgentConnection';
import { useAgentStore } from '../stores/useAgentStore';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { ChatInterface } from './ChatInterface';
import { SideBySideInterface } from './SideBySideInterface';
import { BackgroundJobInterface } from './BackgroundJobInterface';
import { ToolsBar } from './ToolsBar';
import { QuickAccessHeader } from './QuickAccessHeader';
import type { AgentSessionComponent, Tool, WorkflowSpec } from '../types';
import type { WireAgentSessionEvent } from '../types/protocol';
import { loadUIFlags, saveUIFlags } from '../utils/agent-storage';

interface AgentPlaygroundProps {
  /** Session ID from URL (optional, for dynamic route) */
  sessionId?: string;
  /** Server-fetched tools (hydrated into store on mount) */
  initialTools?: Tool[];
  /** Server-fetched workflows (hydrated into store on mount) */
  initialWorkflows?: WorkflowSpec[];
  /** Server-fetched session events (SSR) */
  initialEvents?: WireAgentSessionEvent[] | null;
}

export function AgentPlayground({ sessionId, initialTools, initialWorkflows, initialEvents }: AgentPlaygroundProps) {
  // Hydrate store from localStorage + server-fetched data (client-side only, after mount)
  useHydrateStore({ initialTools, initialWorkflows });
  
  // Sync session ID between URL, localStorage, and store
  useAgentSessionRouting({ urlSessionId: sessionId, initialEvents });

  // Lifecycle + WS connection for branch session transitions
  const { loadAgentSession } = useAgentSessionLifecycle();
  const { send } = useAgentConnection();

  // Handle session_branched — fully transition to the new branch session.
  // The routing hook's initialResolvedRef blocks re-resolution on soft
  // navigation, so we load the session here directly. The routing hook's
  // currentSessionId-sync effect handles URL update automatically.
  const handleSessionBranched = useCallback(async (newSessionId: string) => {
    console.log('[AgentPlayground] handleSessionBranched', { newSessionId: newSessionId.slice(0, 8) });
    const store = useAgentStore.getState();
    const oldSessionId = store.currentSessionId;
    store.cancelEdit();
    if (oldSessionId) {
      send({ type: 'unsubscribe', sessionId: oldSessionId });
    }
    await loadAgentSession(newSessionId);
  }, [send, loadAgentSession]);

  // Subscribe to WS events (session_event, session_created, agent_status, session_branched, error)
  useWsEventIngestion({ onSessionBranched: handleSessionBranched });

  // Reset store on logout
  const reset = useAgentStore((s) => s.reset);
  useEffect(() => {
    let previousUser = useAuthStore.getState().user;
    return useAuthStore.subscribe((state) => {
      if (previousUser && !state.user) reset();
      previousUser = state.user;
    });
  }, [reset]);
  
  const {
    upsertComponent,
    removeComponentsByRole,
    clearAgentSession,
    conversationStatus,
    persistAgentSession,
    ephemeral,
    agentConfig,
    setPersistAgentSession,
    setEphemeral,
    sessionComponents,
    triggerSubmit,
    setScrollToComponentId,
    setAgentConfig,
    currentSessionId,
    uiMode,
    setUiMode,
    selectedJobId,
    selectJob,
  } = useAgent();
  
  // Show BackgroundJobInterface when a job is selected
  const showBackgroundJobUI = selectedJobId !== null;
  
  // Derive isProcessing from conversationStatus
  const isProcessing = conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding';
  
  // Store-based flag to prevent re-showing config panel on route changes
  const hasShownInitialConfig = useAgentStore((s) => s._hasShownInitialConfig);
  const markInitialConfigShown = useAgentStore((s) => s.markInitialConfigShown);
  
  // Separate input state for each interface to preserve on mode switch
  const [sideBySideInput, setSideBySideInput] = useState('');
  
  // Preserve scroll positions for each interface (like browser back/forward)
  const scrollPositions = useRef<{ chat: number; 'side-by-side': number }>({
    chat: 0,
    'side-by-side': 0,
  });
  
  // Preserve carousel slide position for side-by-side interface
  const [carouselSlideIndex, setCarouselSlideIndex] = useState<number | null>(null);
  
  // Track the previous UI mode to save its scroll before unmounting
  const prevUiMode = useRef<'chat' | 'side-by-side'>(uiMode);
  
  // Save and restore scroll position when UI mode changes
  useEffect(() => {
    // Only act when mode actually changed (not on initial mount)
    const modeChanged = prevUiMode.current !== uiMode;
    
    if (modeChanged) {
      // Save scroll position of the PREVIOUS mode before switching
      const container = document.querySelector('.interface-scroll-container');
      if (container) {
        scrollPositions.current[prevUiMode.current] = container.scrollTop;
      }
    }
    
    // Update previous mode tracker
    prevUiMode.current = uiMode;
    
    // Skip restore on initial mount — only restore when switching modes
    if (!modeChanged) return;
    
    // Restore scroll position for the NEW mode after animation completes
    const timer = setTimeout(() => {
      const newContainer = document.querySelector('.interface-scroll-container');
      if (newContainer) {
        newContainer.scrollTop = scrollPositions.current[uiMode];
      }
    }, 250); // Wait for animation to complete
    
    return () => clearTimeout(timer);
  }, [uiMode]);
  
  // Show config panel only on first ever load with empty session and no URL session
  // (URL session means we're about to load events — don't flash config panel)
  useEffect(() => {
    if (!hasShownInitialConfig && sessionComponents.length === 0 && !sessionId) {
      markInitialConfigShown();
      upsertComponent({
        id: 'configurations-panel',
        role: 'system',
        type: 'config-panel',
        isStreaming: false,
        data: {}
      });
    }
  }, [hasShownInitialConfig, sessionComponents.length, sessionId, markInitialConfigShown, upsertComponent]);

  // Load UI flags when mode changes
  useEffect(() => {
    const flags = loadUIFlags(uiMode);
    setPersistAgentSession(flags.persistAgentSession);
    setEphemeral(flags.ephemeral);
  }, [uiMode, setPersistAgentSession, setEphemeral]);
  
  // Save UI flags when they change
  useEffect(() => {
    saveUIFlags(uiMode, { persistAgentSession, ephemeral });
  }, [uiMode, persistAgentSession, ephemeral]);

  

  const handleNewAgentSessionClick = () => {
    // Simply clear the session - no configuration panel
    clearAgentSession();
  };

  // Utility: Handle panel display (create or scroll to existing)
  const handlePanelClick = (panelId: string, panelType: AgentSessionComponent['type']) => {
    const existingPanel = sessionComponents.find(c => c.id === panelId);
    
    if (uiMode === 'side-by-side') {
      // In side-by-side mode, remove all system panels (only one at a time)
      removeComponentsByRole('system');
      upsertComponent({
        id: panelId,
        role: 'system',
        type: panelType,
        isStreaming: false,
        data: {}
      });
    } else if (uiMode === 'chat') {
      if (existingPanel) {
        // Scroll to existing panel
        setScrollToComponentId(panelId);
      } else {
        // Create new panel
        upsertComponent({
          id: panelId,
          role: 'system',
          type: panelType,
          isStreaming: false,
          data: {}
        });
      }
    }
  };

  const handleConfigurationsClick = () => handlePanelClick('configurations-panel', 'config-panel');
  const handleHistoryClick = () => handlePanelClick('history-panel', 'history-panel');
  const handleSettingsClick = () => handlePanelClick('settings-panel', 'settings-panel');

  // Disable text selection when shift is held (for shift+click debug view)
  useEffect(() => {
    const handleShiftDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        document.body.style.userSelect = 'none';
      }
    };

    const handleShiftUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        document.body.style.userSelect = '';
      }
    };

    // Also handle blur to reset selection if user switches windows
    const handleBlur = () => {
      document.body.style.userSelect = '';
    };

    window.addEventListener('keydown', handleShiftDown);
    window.addEventListener('keyup', handleShiftUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleShiftDown);
      window.removeEventListener('keyup', handleShiftUp);
      window.removeEventListener('blur', handleBlur);
      document.body.style.userSelect = '';
    };
  }, []);

  // Global keyboard listener - handle Escape, Enter and printable characters
  const editingComponentId = useAgentStore((s) => s.editingComponentId);
  const resetAllTranslations = useAgentStore((s) => s.resetAllTranslations);
  
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key - highest priority, works everywhere
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset translations (unless in edit mode)
        if (!editingComponentId) {
          resetAllTranslations();
        }
        
        // Dispatch a global collapse event that components listen to
        const event = new Event('agent:collapseAll');
        window.dispatchEvent(event);
        return;
      }
      
      // For other keys, check if we're in a text input
      const target = e.target as HTMLElement;
      const isTextInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
        
      // Skip other keys if in a text field
      if (isTextInput) return;
      
      // Handle Enter key - trigger submit (focuses input)
      if (e.key === 'Enter' && !isProcessing) {
        e.preventDefault();
        triggerSubmit();
        return;
      }
      
      // Handle printable characters - trigger submit to focus input
      // This allows users to start typing immediately from anywhere
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        triggerSubmit();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isProcessing, triggerSubmit]);

  return (
    <div className="h-full w-full bg-background text-foreground">
      {/* Vertically Centered Tools Bar */}
      <ToolsBar 
        onNewSessionClick={handleNewAgentSessionClick}
        onAgentConfigClick={handleConfigurationsClick}
        onHistoryClick={handleHistoryClick}
        onConfigClick={handleSettingsClick}
        isProcessing={isProcessing}
        uiMode={uiMode}
      />

      <div className="h-full flex flex-col">
        {/* Conditional rendering based on background job mode */}
        {showBackgroundJobUI && selectedJobId ? (
          <BackgroundJobInterface jobId={selectedJobId} onBack={() => selectJob(null)} />
        ) : (
          <>
            {/* Quick Access Header */}
            <QuickAccessHeader />

            {/* Animated Interface Transition with Scroll Preservation */}
            <AnimatePresence mode="wait">
              {uiMode === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex-1 overflow-y-hidden"
                >
                  <ChatInterface />
                </motion.div>
              ) : (
                <motion.div
                  key="side-by-side"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex-1 overflow-hidden"
                >
                  <SideBySideInterface 
                    onInputChange={setSideBySideInput}
                    initialSlideIndex={carouselSlideIndex}
                    onSlideIndexChange={setCarouselSlideIndex}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
