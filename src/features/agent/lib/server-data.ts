/**
 * Server-side data fetching for the agent feature.
 * Called from Server Components — fetches directly from the backend.
 */

import type { Tool, Workflow, ModelParameterSchema, ModelSpec } from '../types';
import type { WireAgentSessionEvent } from '../types/protocol';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

type RegisteredModel = {
  providerId: string;
  providerName: string;
  source: 'built-in' | 'custom';
  model: ModelSpec;
};

function normalizeModelRegistry(data: Record<string, unknown>): { models: ModelSpec[]; defaultModelId: string | null } | null {
  if (data.contractVersion === 4) {
    const entries = Array.isArray(data.models) ? data.models as RegisteredModel[] : [];
    return {
      models: entries.flatMap((entry) => {
        if (!entry?.model?.id || !entry.providerId) return [];
        return [{
          ...entry.model,
          providerId: entry.providerId,
          providerName: entry.providerName,
          source: entry.source,
          provider: entry.providerId === 'openrouter' ? entry.model.provider : entry.providerName,
        }];
      }),
      defaultModelId: typeof data.defaultModelId === 'string' ? data.defaultModelId : null,
    };
  }

  if (data.contractVersion === 3) {
    return {
      models: Array.isArray(data.models) ? data.models as ModelSpec[] : [],
      defaultModelId: typeof data.defaultModelId === 'string' ? data.defaultModelId : null,
    };
  }

  return null;
}

export interface AgentServerData {
  tools: Tool[];
  workflows: Workflow[];
  models: ModelSpec[];
  modelParameters: Record<string, ModelParameterSchema>;
  defaultModelId: string | null;
}

/**
 * Fetch tools, workflows, and models from the backend.
 * Requires the JWT token for authorization.
 * Returns empty arrays on failure (non-blocking).
 */
export async function fetchAgentServerData(token: string): Promise<AgentServerData> {
  const headers = { Authorization: `Bearer ${token}` };
  const empty: AgentServerData = { tools: [], workflows: [], models: [], modelParameters: {}, defaultModelId: null };

  try {
    const [toolsRes, workflowsRes, modelsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/agent/tools`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}/agent/workflows`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}/agent/models`, { headers, cache: 'no-store' }),
    ]);

    const tools = toolsRes.ok ? (await toolsRes.json()).tools ?? [] : [];
    const workflows = workflowsRes.ok ? (await workflowsRes.json()).workflows ?? [] : [];
    const modelsData = modelsRes.ok ? await modelsRes.json() : {};

    const registry = modelsRes.ok ? normalizeModelRegistry(modelsData) : null;
    if (modelsRes.ok && !registry) {
      console.warn(
        '[agent/server-data] Unsupported model contract version:',
        modelsData.contractVersion
      );
      return { ...empty, tools, workflows };
    }

    const models = registry?.models ?? [];
    const modelParameters = modelsData.parameters ?? {};
    const defaultModelId = registry?.defaultModelId ?? null;

    return { tools, workflows, models, modelParameters, defaultModelId };
  } catch (err) {
    console.error('[agent/server-data] Failed to fetch:', err instanceof Error ? err.message : String(err));
    return empty;
  }
}

/**
 * Fetch session events from the backend (server-side).
 * Returns events as wire format (ISO string timestamps) for SSR serialization.
 * Returns null on failure (non-blocking).
 */
export async function fetchSessionEventsSSR(
  token: string,
  sessionId: string
): Promise<WireAgentSessionEvent[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/agent/sessions/${sessionId}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return (data.events ?? []) as WireAgentSessionEvent[];
  } catch (err) {
    console.error('[agent/server-data] Failed to fetch session events:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
