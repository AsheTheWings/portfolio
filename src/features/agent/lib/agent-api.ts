'use client';

/**
 * Agent REST Client
 *
 * Typed functions wrapping HTTP calls to the backend REST API.
 * All calls go through Next.js proxy routes (/api/agent/*) which
 * attach the auth cookie as a Bearer token.
 */

import type { ModelSpec } from '../types/llm';
import type {
  AgentConfig,
  AgentSessionEvent,
  AgentSessionMetadata,
  SavedAgent,
} from '../types/session';

// ============================================================
// Types
// ============================================================

export interface AgentSessionListItem {
  id: string;
  userId: string;
  agentName: string;
  title: string | null;
  titleLocked: boolean;
  rootSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSessionEventsResponse {
  session: AgentSessionListItem;
  events: AgentSessionEvent[];
}

export interface ModelsResponse {
  contractVersion: number;
  models: ModelSpec[];
  providers: string[];
  defaultModelId: string;
}

export interface BranchResponse {
  sessionId: string;
  metadata: AgentSessionMetadata;
}

// ============================================================
// API Functions
// ============================================================

const BASE = '/api/agent';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch(`${BASE}/models`, { credentials: 'include' });
  return json<ModelsResponse>(res);
}

export async function fetchAgentSessions(search?: string): Promise<AgentSessionListItem[]> {
  const url = search ? `${BASE}/sessions?search=${encodeURIComponent(search)}` : `${BASE}/sessions`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await json<{ sessions: AgentSessionListItem[] }>(res);
  return data.sessions;
}

export async function fetchAgentSessionEvents(sessionId: string): Promise<AgentSessionEventsResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/events`, { credentials: 'include' });
  return json<AgentSessionEventsResponse>(res);
}

export async function deleteAgentSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await json<{ success: boolean }>(res);
}

export async function updateAgentSession(
  sessionId: string,
  updates: { title?: string; titleLocked?: boolean; workflow?: string },
): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  await json<{ success: boolean }>(res);
}

export async function translateText(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const res = await fetch(`${BASE}/translate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLanguage }),
  });
  const data = await json<{ translatedText: string }>(res);
  return data.translatedText;
}

// ============================================================
// Agents (Saved Agent Presets)
// ============================================================

export async function fetchAgents(): Promise<SavedAgent[]> {
  const res = await fetch(`${BASE}/agents`, { credentials: 'include' });
  const data = await json<{ agents: SavedAgent[] }>(res);
  return data.agents;
}

export async function fetchAgent(agentId: string): Promise<SavedAgent> {
  const res = await fetch(`${BASE}/agents/${agentId}`, { credentials: 'include' });
  const data = await json<{ agent: SavedAgent }>(res);
  return data.agent;
}

export async function createAgent(data: {
  name: string;
  description?: string;
  agentConfig: AgentConfig;
  isPublic?: boolean;
}): Promise<SavedAgent> {
  const res = await fetch(`${BASE}/agents`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await json<{ agent: SavedAgent }>(res);
  return result.agent;
}

export async function updateAgent(
  agentId: string,
  updates: { name?: string; description?: string; isPublic?: boolean },
): Promise<SavedAgent> {
  const res = await fetch(`${BASE}/agents/${agentId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const result = await json<{ agent: SavedAgent }>(res);
  return result.agent;
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await json<{ success: boolean }>(res);
}

// ============================================================
// Agent Acquisitions
// ============================================================

/**
 * Fetch all acquired agents (owned + explicitly acquired public agents).
 * Used by session restore and AgentConfigPanel dropdown.
 */
export async function fetchAcquiredAgents(): Promise<SavedAgent[]> {
  const res = await fetch(`${BASE}/agents/acquired`, { credentials: 'include' });
  const data = await json<{ agents: SavedAgent[] }>(res);
  return data.agents;
}

/**
 * Search agents by name/description (owned + public).
 * Used for agent discovery in AgentsHub.
 */
export async function searchAgents(query: string, limit = 20, offset = 0): Promise<SavedAgent[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
  const res = await fetch(`${BASE}/agents/search?${params}`, { credentials: 'include' });
  const data = await json<{ agents: SavedAgent[] }>(res);
  return data.agents;
}

/**
 * Acquire (subscribe to) a public agent.
 */
export async function acquireAgent(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/acquire`, {
    method: 'POST',
    credentials: 'include',
  });
  await json<{ success: boolean }>(res);
}

/**
 * Release (unsubscribe from) an acquired agent.
 */
export async function releaseAgent(agentId: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/acquire`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await json<{ success: boolean }>(res);
}
