'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { loadAgentConfig } from '../utils/agent-storage';

export function useHydrateStore() {
  useEffect(() => {
    // Only run once on mount
    const isHydrated = (useAgentStore.getState() as any)._hydrated;
    if (isHydrated) return;
    
    // Load config from localStorage
    const savedConfig = loadAgentConfig();
    
    // Update store with saved config
    useAgentStore.setState({ 
      agentConfig: savedConfig,
      _hydrated: true 
    } as any);
  }, []);
}
