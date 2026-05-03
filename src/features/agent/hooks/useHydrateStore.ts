'use client';

/**
 * useHydrateStore Hook
 * Hydrates the agent store from localStorage and server-fetched data after client mount
 * Prevents SSR hydration mismatches
 */

import { useEffect, useRef } from 'react';
import { useAgentStore, selectModelsById } from '../stores/useAgentStore';
import { loadAgents, loadSelectedWorkflowId, saveSelectedWorkflowId } from '../utils/agent-storage';
import { createDefaultAgentConfig } from '../utils/agent-factory';
import type { Tool, Workflow, ModelSpec, AgentState, Agent } from '../types';
import { ModelCapability } from '../types';

function reconcileAgentsAgainstCatalog(
  agents: Agent[],
  modelsPool: ModelSpec[],
  defaultModelId: string | null
): Agent[] {
  if (!defaultModelId) return agents;

  const modelsById = selectModelsById(modelsPool);

  // Guard: defaultModelId itself must be in catalog
  if (!modelsById[defaultModelId]) return agents;

  let changed = false;
  const reconciled = agents.map(agent => {
    let config = { ...agent.config };

    const model = modelsById[config.modelId];

    if (!model) {
      // Stale model id: rebuild full config from catalog-aware defaults
      config = createDefaultAgentConfig(defaultModelId, modelsPool);
      changed = true;
    } else {
      // 2. Capability-derived settings (disable unsupported only)
      if (!model.capabilities.includes(ModelCapability.THINKING)) {
        if (config.enableThinking) {
          config.enableThinking = false;
          changed = true;
        }
        if (config.includeThoughtsInResponse) {
          config.includeThoughtsInResponse = false;
          changed = true;
        }
        if (config.includeThoughtsInContext) {
          config.includeThoughtsInContext = false;
          changed = true;
        }
      }

      // 3. Native tool ids validity
      const validNativeToolIds = (config.selectedNativeToolIds || [])
        .filter(id => model.nativeTools?.some(t => t.id === id));
      if (validNativeToolIds.length !== (config.selectedNativeToolIds || []).length) {
        config.selectedNativeToolIds = validNativeToolIds;
        changed = true;
      }
    }

    return { ...agent, config };
  });

  return changed ? reconciled : agents;
}

interface HydrateOptions {
  initialTools?: Tool[];
  initialWorkflows?: Workflow[];
  initialModels?: ModelSpec[];
  initialDefaultModelId?: string | null;
}

export function useHydrateStore({ initialTools, initialWorkflows, initialModels, initialDefaultModelId }: HydrateOptions = {}) {
  const initialToolsRef = useRef(initialTools);
  const initialWorkflowsRef = useRef(initialWorkflows);
  const initialModelsRef = useRef(initialModels);
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
      useAgentStore.getState().setModelsPool(models, defaultModelId ?? undefined);

      // Reconcile persisted agents against catalog
      const storeAgents = useAgentStore.getState().agents;
      const reconciled = reconcileAgentsAgainstCatalog(storeAgents, models, defaultModelId);
      if (reconciled !== storeAgents) {
        useAgentStore.getState().setAgents(reconciled);
      }
    }
  }, []);
}
