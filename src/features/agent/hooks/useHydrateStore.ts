'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage and server-fetched data after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/useAgentStore';
import { loadAgents, loadSelectedWorkflowId, saveSelectedWorkflowId } from '../utils/agent-storage';
import type { Tool, Workflow, ModelParameterSchema, ModelSpec, AgentState } from '../types';

interface HydrateOptions {
  initialTools?: Tool[];
  initialWorkflows?: Workflow[];
  initialModels?: ModelSpec[];
  initialModelParameters?: ModelParameterSchema[];
  initialDefaultModelId?: string | null;
}

export function useHydrateStore({ initialTools, initialWorkflows, initialModels, initialModelParameters, initialDefaultModelId }: HydrateOptions = {}) {
  const initialToolsRef = useRef(initialTools);
  const initialWorkflowsRef = useRef(initialWorkflows);
  const initialModelsRef = useRef(initialModels);
  const initialModelParametersRef = useRef(initialModelParameters);
  const initialDefaultModelIdRef = useRef(initialDefaultModelId);

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
      const workflows = initialWorkflowsRef.current;
      useAgentStore.getState().setWorkflowsPool(workflows);

      // Resolve selectedWorkflowId: persisted id → valid registry entry → default
      const storedId = loadSelectedWorkflowId();
      const defaultId = (workflows.find((w) => w.isDefault) ?? workflows[0])?.id ?? '';
      const resolved = storedId && workflows.some((w) => w.id === storedId) ? storedId : defaultId;
      useAgentStore.getState().setSelectedWorkflowId(resolved);
      if (resolved !== storedId) saveSelectedWorkflowId(resolved);
    }
    if (initialModelsRef.current?.length) {
      const models = initialModelsRef.current;
      const defaultModelId = initialDefaultModelIdRef.current ?? null;
      useAgentStore.getState().setModelsPool(models, defaultModelId ?? undefined, initialModelParametersRef.current ?? []);
    }
  }, []);
}
