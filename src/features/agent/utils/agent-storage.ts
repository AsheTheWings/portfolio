/**
 * Agent Configuration Management
 * LocalStorage utilities for AgentConfig persistence
 */

import type { AgentConfig } from '../types';
import { createDefaultAgentConfig } from '../services/models-registry';

const AGENT_CONFIG_KEY = 'timeline:agent:config';

/**
 * Load agent config from localStorage
 * Returns default config if not found or invalid
 */
export function loadAgentConfig(): AgentConfig {
  try {
    const stored = localStorage.getItem(AGENT_CONFIG_KEY);
    
    if (!stored) {
      return createDefaultAgentConfig();
    }

    const config = JSON.parse(stored) as AgentConfig;
    
    // Tools are infrastructure (discovered per session), not preferences
    // Always start with empty availableTools - will be auto-populated from fresh toolsPool
    // when enableTools is true (via store's auto-population logic)
    
    // Merge with defaults to ensure all fields exist
    return {
      ...createDefaultAgentConfig(),
      ...config,
      availableTools: [], // ← Always fresh, never from cache
    };
  } catch (err) {
    console.error('Failed to load agent config:', err);
    return createDefaultAgentConfig();
  }
}

/**
 * Save agent config to localStorage
 */
export function saveAgentConfig(config: AgentConfig): void {
  try {
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save agent config:', err);
  }
}

/**
 * Clear agent config from localStorage
 */
export function clearAgentConfig(): void {
  try {
    localStorage.removeItem(AGENT_CONFIG_KEY);
  } catch (err) {
    console.error('Failed to clear agent config:', err);
  }
}

/**
 * UI Flags Management - scoped by interface mode
 */

export interface UIFlags {
  persistAgentSession: boolean;
  ephemeral: boolean;
}

const UI_FLAGS_PREFIX = 'timeline:ui-flags';

/**
 * Load UI flags for a specific interface mode
 */
export function loadUIFlags(mode: 'chat' | 'side-by-side'): UIFlags {
  try {
    const key = `${UI_FLAGS_PREFIX}:${mode}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      // Default values per mode
      return mode === 'side-by-side' 
        ? { persistAgentSession: false, ephemeral: true }
        : { persistAgentSession: true, ephemeral: false };
    }

    return JSON.parse(stored) as UIFlags;
  } catch (err) {
    console.error(`Failed to load UI flags for ${mode}:`, err);
    return mode === 'side-by-side' 
      ? { persistAgentSession: false, ephemeral: true }
      : { persistAgentSession: true, ephemeral: false };
  }
}

/**
 * Save UI flags for a specific interface mode
 */
export function saveUIFlags(mode: 'chat' | 'side-by-side', flags: UIFlags): void {
  try {
    const key = `${UI_FLAGS_PREFIX}:${mode}`;
    localStorage.setItem(key, JSON.stringify(flags));
  } catch (err) {
    console.error(`Failed to save UI flags for ${mode}:`, err);
  }
}

/**
 * Current Session ID Management
 * Persists session ID as a non-httpOnly cookie so both client and server can read it.
 * Server reads it in page.tsx to redirect `/` → `/<sessionId>` without a client round-trip.
 */

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
