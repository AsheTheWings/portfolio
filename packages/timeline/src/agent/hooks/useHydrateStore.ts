'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage and server-fetched data after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { loadAgents, loadSelectedWorkflowId, saveSelectedWorkflowId } from '../utils/agent-storage';
import type { AgentServerData } from '../lib/server-data';
import type { AgentState } from '../types';

interface HydrateOptions {
  initialAgentData?: AgentServerData;
}

export function useHydrateStore({ initialAgentData }: HydrateOptions = {}) {
  const initialAgentDataRef = useRef(initialAgentData);

  useEffect(() => {
    const state = useAgentStore.getState();
    if (state._hydrated) return;

    const savedAgents = loadAgents();

    // Route through setAgents for invariant enforcement ('none' always present)
    state.setAgents(savedAgents);
    useAgentStore.setState({ _hydrated: true } as Partial<AgentState>);

    const agentData = initialAgentDataRef.current;

    if (agentData?.tools.length) {
      useAgentStore.getState().setToolsPool(agentData.tools);
    }
    if (agentData?.workflows.length) {
      const workflows = agentData.workflows;
      useAgentStore.getState().setWorkflowsPool(workflows);

      // Resolve selectedWorkflowId: persisted id → valid registry entry → default.
      const storedId = loadSelectedWorkflowId();
      const defaultId = (workflows.find((w) => w.isDefault) ?? workflows[0])?.id ?? '';
      const resolved = storedId && workflows.some((w) => w.id === storedId) ? storedId : defaultId;
      useAgentStore.getState().setSelectedWorkflowId(resolved);
      if (resolved !== storedId) saveSelectedWorkflowId(resolved);
    }
    if (agentData?.llmRegistry) {
      useAgentStore.getState().setLlmRegistry(agentData.llmRegistry);
    }
  }, []);
}
