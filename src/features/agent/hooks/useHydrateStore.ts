'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage and server-fetched data after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { loadAgentConfig } from '../utils/agent-storage';
import type { Tool, WorkflowSpec } from '../types';

interface HydrateOptions {
  initialTools?: Tool[];
  initialWorkflows?: WorkflowSpec[];
}

export function useHydrateStore({ initialTools, initialWorkflows }: HydrateOptions = {}) {
  useEffect(() => {
    const isHydrated = (useAgentStore.getState() as any)._hydrated;
    if (isHydrated) return;
  
    const savedConfig = loadAgentConfig();
    
    useAgentStore.setState({ 
      agentConfig: savedConfig,
      _hydrated: true 
    } as any);

    if (initialTools?.length) {
      useAgentStore.getState().setToolsPool(initialTools);
    }
    if (initialWorkflows?.length) {
      useAgentStore.getState().setWorkflowsPool(initialWorkflows);
    }
  }, []);
}
