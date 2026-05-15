/**
 * Server-side data fetching for the agent feature.
 *
 * Consumes the canonical `LlmRegistrySnapshot` (contractVersion 5). Older
 * contract versions are intentionally not supported.
 */

import type { LlmRegistrySnapshot, ModelParameterSchema, ModelSpec, Tool, Workflow } from '../types';
import type { WireSessionEvent } from '../types/protocol';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export interface AgentServerData {
  tools: Tool[];
  workflows: Workflow[];
  models: ModelSpec[];
  /**
   * Ordered parameter schemas. Render order follows array order; clients
   * filter `schema.hidden` and intersect with `ModelSpec.supportedParameters`.
   */
  modelParameters: ModelParameterSchema[];
  defaultModelId: string | null;
}

function isValidRegistry(value: unknown): value is LlmRegistrySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.contractVersion === 5
    && Array.isArray(v.models)
    && typeof v.defaultModelId === 'string'
    && Array.isArray(v.parameters);
}

/**
 * Fetch tools, workflows, and the LLM registry from the backend. Requires
 * the JWT token for authorization. Failures degrade to empty data —
 * non-blocking by design.
 */
export async function fetchAgentServerData(token: string): Promise<AgentServerData> {
  const headers = { Authorization: `Bearer ${token}` };
  const empty: AgentServerData = {
    tools: [],
    workflows: [],
    models: [],
    modelParameters: [],
    defaultModelId: null,
  };

  try {
    const [toolsRes, workflowsRes, modelsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/agent/tools`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}/agent/workflows`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}/agent/models`, { headers, cache: 'no-store' }),
    ]);

    const tools = toolsRes.ok ? (await toolsRes.json()).tools ?? [] : [];
    const workflows = workflowsRes.ok ? (await workflowsRes.json()).workflows ?? [] : [];

    if (!modelsRes.ok) return { ...empty, tools, workflows };

    const modelsData: unknown = await modelsRes.json();
    if (!isValidRegistry(modelsData)) {
      const version = (modelsData as { contractVersion?: unknown } | null)?.contractVersion;
      console.warn('[agent/server-data] Unsupported model contract version:', version);
      return { ...empty, tools, workflows };
    }

    return {
      tools,
      workflows,
      models: modelsData.models,
      modelParameters: modelsData.parameters,
      defaultModelId: modelsData.defaultModelId,
    };
  } catch (err) {
    console.error('[agent/server-data] Failed to fetch:', err instanceof Error ? err.message : String(err));
    return empty;
  }
}

/**
 * Fetch session events from the backend (server-side). Returns events as
 * wire format (ISO timestamps) for SSR serialization.
 */
export async function fetchSessionEventsSSR(
  token: string,
  sessionId: string,
): Promise<WireSessionEvent[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/agent/sessions/${sessionId}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return (data.events ?? []) as WireSessionEvent[];
  } catch (err) {
    console.error('[agent/server-data] Failed to fetch session events:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
