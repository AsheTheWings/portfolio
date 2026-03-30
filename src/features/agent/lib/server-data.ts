/**
 * Server-side data fetching for the agent feature.
 * Called from Server Components — fetches directly from the backend.
 */

import type { Tool, WorkflowSpec } from '../types';
import type { WireAgentSessionEvent } from '../types/protocol';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export interface AgentServerData {
  tools: Tool[];
  workflows: WorkflowSpec[];
}

/**
 * Fetch tools and workflows from the backend.
 * Requires the JWT token for authorization.
 * Returns empty arrays on failure (non-blocking).
 */
export async function fetchAgentServerData(token: string): Promise<AgentServerData> {
  const headers = { Authorization: `Bearer ${token}` };
  const empty: AgentServerData = { tools: [], workflows: [] };

  try {
    const [toolsRes, workflowsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/agent/tools`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}/agent/workflows`, { headers, cache: 'no-store' }),
    ]);

    const tools = toolsRes.ok ? (await toolsRes.json()).tools ?? [] : [];
    const workflows = workflowsRes.ok ? (await workflowsRes.json()).workflows ?? [] : [];

    return { tools, workflows };
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
