'use client';

/**
 * Agent Playground - Full playground implementation
 * Provides ToolsBar, QuickAccessHeader, and routes ChatInterface/FlatInterface
 * based on uiInterface.
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAgent } from '../hooks/useAgent';
import { useHydrateStore } from '../hooks/useHydrateStore';
import { useAgentSessionRouting } from '../hooks/useAgentSessionRouting';
import { useAgentSessionLifecycle } from '../hooks/useAgentSessionLifecycle';
import { useWsEventIngestion } from '../hooks/useWsEventIngestion';
import { useAgentConnection } from '../hooks/useAgentConnection';
import { useAgentStore } from '../stores/useAgentStore';
import { useAcquiredAgentsQuery } from '../hooks/useAcquiredAgentsQuery';
import { useAuthStore } from '@/features/authentication/stores/authStore';
import { ChatInterface } from './ChatInterface';
import { FlatInterface } from './FlatInterface';
import { ToolsBar } from './ToolsBar';
import { QuickAccessHeader } from './QuickAccessHeader';
import { AgentsHub } from './AgentsHub';
import type { AgentSessionComponentType, Tool, WorkflowSpec, ModelSpec } from '../types';
import type { WireAgentSessionEvent } from '../types/protocol';
import { loadUIFlags, saveUIFlags } from '../utils/agent-storage';

interface AgentPlaygroundProps {
  /** Session ID from URL (optional, for dynamic route) */
  sessionId?: string;
  /** Server-fetched tools (hydrated into store on mount) */
  initialTools?: Tool[];
  /** Server-fetched workflows (hydrated into store on mount) */
  initialWorkflows?: WorkflowSpec[];
  /** Server-fetched models (hydrated into store on mount) */
  initialModels?: ModelSpec[];
  /** Server-fetched session events (SSR) */
  initialEvents?: WireAgentSessionEvent[] | null;
}

export function AgentPlayground({ sessionId, initialTools, initialWorkflows, initialModels, initialEvents }: AgentPlaygroundProps) {
  // Hydrate store from localStorage + server-fetched data (client-side only, after mount)
  useHydrateStore({ initialTools, initialWorkflows, initialModels });
  
  // Fetch acquired agents (owned + subscribed) and push into store
  useAcquiredAgentsQuery();
  
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
    upsertSystemPanel,
    clearAgentSession,
    conversationStatus,
    persistAgentSession,
    ephemeral,
    setPersistAgentSession,
    setEphemeral,
    sessionComponents,
    triggerSubmit,
    setScrollToComponentId,
    uiInterface,
  } = useAgent();
  
  // Derive isProcessing from conversationStatus
  const isProcessing = conversationStatus === 'processing' || conversationStatus === 'thinking' || conversationStatus === 'toolCalling' || conversationStatus === 'responding';
  
  // Store-based flag to prevent re-showing config panel on route changes
  const hasShownInitialConfig = useAgentStore((s) => s._hasShownInitialConfig);
  const markInitialConfigShown = useAgentStore((s) => s.markInitialConfigShown);
  
  // Agents Hub overlay
  const [showAgentsHub, setShowAgentsHub] = useState(false);
  
  // Show config panel only on first ever load with empty session and no URL session
  // (URL session means we're about to load events — don't flash config panel)
  useEffect(() => {
    if (!hasShownInitialConfig && sessionComponents.length === 0 && !sessionId) {
      markInitialConfigShown();
      upsertSystemPanel('configurations-panel', 'config-panel');
    }
  }, [hasShownInitialConfig, sessionComponents.length, sessionId, markInitialConfigShown, upsertSystemPanel]);

  // Load UI flags when interface changes
  useEffect(() => {
    const flags = loadUIFlags(uiInterface);
    setPersistAgentSession(flags.persistAgentSession);
    setEphemeral(flags.ephemeral);
  }, [uiInterface, setPersistAgentSession, setEphemeral]);
  
  // Save UI flags when they change
  useEffect(() => {
    saveUIFlags(uiInterface, { persistAgentSession, ephemeral });
  }, [uiInterface, persistAgentSession, ephemeral]);

  

  const handleNewAgentSessionClick = () => {
    // Simply clear the session - no configuration panel
    clearAgentSession();
  };

  // Utility: Handle panel display (create or scroll to existing)
  const handlePanelClick = (panelId: string, panelType: AgentSessionComponentType) => {
    const existingPanel = sessionComponents.find(c => c.id === panelId);
    if (existingPanel) {
      setScrollToComponentId(panelId);
    } else {
      upsertSystemPanel(panelId, panelType);
    }
  };

  const handleConfigurationsClick = () => handlePanelClick('configurations-panel', 'config-panel');
  const handleHistoryClick = () => handlePanelClick('history-panel', 'history-panel');
  const handleSettingsClick = () => handlePanelClick('settings-panel', 'settings-panel');

  // Global keyboard listener - handle Escape, Enter and printable characters
  const editingEventId = useAgentStore((s) => s.editingEventId);
  const resetAllTranslations = useAgentStore((s) => s.resetAllTranslations);
  
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key - highest priority, works everywhere
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Reset translations (unless in edit mode)
        if (!editingEventId) {
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
  }, [isProcessing, triggerSubmit, editingEventId, resetAllTranslations]);

  return (
    <div className="h-full w-full bg-background text-foreground">
      {/* Vertically Centered Tools Bar */}
      <ToolsBar 
        onNewSessionClick={handleNewAgentSessionClick}
        onAgentConfigClick={handleConfigurationsClick}
        onHistoryClick={handleHistoryClick}
        onConfigClick={handleSettingsClick}
        onAgentsHubClick={() => setShowAgentsHub((v) => !v)}
        isProcessing={isProcessing}
        uiInterface={uiInterface}
      />

      <div className="h-full flex flex-col relative">
        {/* Agents Hub overlay */}
        {showAgentsHub && (
          <AgentsHub onClose={() => setShowAgentsHub(false)} />
        )}

        {/* Conditional rendering based on UI interface */}
        <>
            {/* Quick Access Header */}
            <QuickAccessHeader />

            {/* Animated Interface Transition with Scroll Preservation */}
            <AnimatePresence mode="wait">
              {uiInterface === 'chat' ? (
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
                  key="flat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex-1 overflow-hidden"
                >
                  <FlatInterface />
                </motion.div>
              )}
            </AnimatePresence>
          </>
      </div>
    </div>
  );
}
