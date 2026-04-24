/**
 * Agent Configuration Management
 * LocalStorage utilities for Agent[] persistence
 */

import type { Agent } from '../types';
import { createDefaultAgentConfig, createAssistantAgent } from '../services/models-registry';

const AGENTS_KEY = 'timeline:agent:agents';

// ============================================================
// agents[] persistence
// ============================================================

/**
 * Load agents array from localStorage.
 * Returns [defaultAgent] if nothing stored.
 */
export function loadAgents(): Agent[] {
  try {
    const stored = localStorage.getItem(AGENTS_KEY);
    if (stored) {
      const agents = JSON.parse(stored) as Agent[];
      if (Array.isArray(agents) && agents.length > 0) {
        // Merge each config with defaults to ensure all fields exist
        const merged = agents.map(a => ({
          agentId: a.agentId,
          config: { ...createDefaultAgentConfig(), ...a.config },
        }));
        // Invariant: ensure 'none' (assistant) always exists
        if (!merged.some(a => a.agentId === 'none')) {
          merged.unshift(createAssistantAgent());
        }
        return merged;
      }
    }

    return [createAssistantAgent()];
  } catch (err) {
    console.error('Failed to load agents:', err);
    return [createAssistantAgent()];
  }
}

/**
 * Save agents array to localStorage
 */
export function saveAgents(agents: Agent[]): void {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  } catch (err) {
    console.error('Failed to save agents:', err);
  }
}

/**
 * Clear agents from localStorage
 */
export function clearAgents(): void {
  try {
    localStorage.removeItem(AGENTS_KEY);
  } catch (err) {
    console.error('Failed to clear agents:', err);
  }
}

/**
 * UI Flags Management - scoped by interface mode
 */

export interface UIFlags {
  persistAgentSession: boolean;
  ephemeral: boolean;
}

const UI_FLAGS_PREFIX = 'timeline:agent:uiFlags';

/**
 * Load UI flags for a specific interface mode
 */
export function loadUIFlags(uiInterface: 'chat' | 'flat'): UIFlags {
  try {
    const key = `${UI_FLAGS_PREFIX}:${uiInterface}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      // Default values per interface
      return uiInterface === 'flat' 
        ? { persistAgentSession: false, ephemeral: true }
        : { persistAgentSession: true, ephemeral: false };
    }

    return JSON.parse(stored) as UIFlags;
  } catch (err) {
    console.error(`Failed to load UI flags for ${uiInterface}:`, err);
    return uiInterface === 'flat' 
      ? { persistAgentSession: false, ephemeral: true }
      : { persistAgentSession: true, ephemeral: false };
  }
}

/**
 * Save UI flags for a specific interface mode
 */
export function saveUIFlags(uiInterface: 'chat' | 'flat', flags: UIFlags): void {
  try {
    const key = `${UI_FLAGS_PREFIX}:${uiInterface}`;
    localStorage.setItem(key, JSON.stringify(flags));
  } catch (err) {
    console.error(`Failed to save UI flags for ${uiInterface}:`, err);
  }
}

// ============================================================
// Selected Workflow Persistence
// ============================================================

const WORKFLOW_KEY = 'timeline:agent:selectedWorkflowId';

/**
 * Persist the user's selected workflow id to localStorage.
 */
export function saveSelectedWorkflowId(id: string): void {
  try {
    localStorage.setItem(WORKFLOW_KEY, id);
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Load the persisted workflow id. Returns null if nothing stored.
 */
export function loadSelectedWorkflowId(): string | null {
  try {
    return localStorage.getItem(WORKFLOW_KEY);
  } catch {
    return null;
  }
}

// ============================================================
// Current Session ID Management
//
// Persists session ID as a non-httpOnly cookie so both client and server can read it.
// Server reads it in page.tsx to redirect `/` → `/<sessionId>` without a client round-trip.
// ============================================================

const SESSION_COOKIE_NAME = 'timeline_last_session';
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Save current session ID to a cookie (readable by server and client)
 */
export function saveCurrentAgentSessionId(sessionId: string | null): void {
  if (sessionId) {
    document.cookie = `${SESSION_COOKIE_NAME}=${sessionId}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`;
  } else {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }
}
