'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage and server-fetched data after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { loadAgents } from '../utils/agent-storage';
import type { Tool, WorkflowSpec, ModelSpec, AgentState } from '../types';

interface HydrateOptions {
  initialTools?: Tool[];
  initialWorkflows?: WorkflowSpec[];
  initialModels?: ModelSpec[];
}

export function useHydrateStore({ initialTools, initialWorkflows, initialModels }: HydrateOptions = {}) {
  const initialToolsRef = useRef(initialTools);
  const initialWorkflowsRef = useRef(initialWorkflows);
  const initialModelsRef = useRef(initialModels);

  useEffect(() => {
    const state = useAgentStore.getState();
    if (state._hydrated) return;
  
    const savedAgents = loadAgents();
    
    // Route through setAgents for invariant enforcement ('none' always present)
    state.setAgents(savedAgents);
    useAgentStore.setState({ _hydrated: true } as Partial<AgentState>);

    if (initialToolsRef.current?.length) {
      useAgentStore.getState().setToolsPool(initialToolsRef.current);
    }
    if (initialWorkflowsRef.current?.length) {
      useAgentStore.getState().setWorkflowsPool(initialWorkflowsRef.current);
    }
    if (initialModelsRef.current?.length) {
      useAgentStore.getState().setModelsPool(initialModelsRef.current);
    }
  }, []);
}
