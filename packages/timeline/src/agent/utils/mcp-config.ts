/**
 * MCP Configuration Management
 * LocalStorage utilities for MCP config
 */

import type { McpConfig } from '../types';

const MCP_CONFIG_KEY = 'timeline:agent:mcpConfig';
const TOOL_PREFERENCES_KEY = 'timeline:agent:toolPreferences';
const MCP_SERVER_NAME = /^[A-Za-z0-9._-]{1,128}$/;

export function normalizeMcpConfig(value: unknown): McpConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Local MCP configuration must be an object');
  }
  const input = value as Record<string, unknown>;
  if (typeof input.enabled !== 'boolean') throw new Error('Local MCP enabled must be boolean');
  if (!Number.isInteger(input.port) || Number(input.port) < 1 || Number(input.port) > 65_535) {
    throw new Error('Local MCP port must be an integer between 1 and 65535');
  }
  if (!Array.isArray(input.servers) || input.servers.length > 100) {
    throw new Error('Local MCP servers must be an array of at most 100 entries');
  }
  const names = new Set<string>();
  const servers = input.servers.map((server) => {
    if (!server || typeof server !== 'object' || Array.isArray(server)) {
      throw new Error('Local MCP server configuration is invalid');
    }
    const name = (server as Record<string, unknown>).name;
    if (typeof name !== 'string' || !MCP_SERVER_NAME.test(name) || names.has(name)) {
      throw new Error('Local MCP server names must be unique safe identifiers');
    }
    names.add(name);
    return { name };
  });
  if (
    input.pairingToken !== undefined
    && (typeof input.pairingToken !== 'string' || input.pairingToken.length < 1 || input.pairingToken.length > 4_096)
  ) {
    throw new Error('Local MCP pairing token is invalid');
  }
  return {
    enabled: input.enabled,
    port: Number(input.port),
    servers,
    ...(typeof input.pairingToken === 'string' ? { pairingToken: input.pairingToken } : {}),
  };
}

/**
 * Default MCP configuration
 */
export function getDefaultMcpConfig(): McpConfig {
  return {
    enabled: false,
    port: 8765,
    servers: [
      { name: 'image-analysis' },
      { name: 'context7' },
    ],
  };
}

/**
 * Load MCP config from localStorage
 */
export function loadMcpConfig(): McpConfig {
  try {
    const stored = localStorage.getItem(MCP_CONFIG_KEY);
    if (!stored) {
      return getDefaultMcpConfig();
    }

    return normalizeMcpConfig(JSON.parse(stored));
  } catch (err) {
    console.error('Failed to load MCP config:', err);
    return getDefaultMcpConfig();
  }
}

/**
 * Save MCP config to localStorage
 */
export function saveMcpConfig(config: McpConfig): void {
  try {
    const safeConfig = normalizeMcpConfig(config);
    localStorage.setItem(MCP_CONFIG_KEY, JSON.stringify(safeConfig));
  } catch (err) {
    console.error('Failed to save MCP config:', err);
  }
}

/**
 * Tool preferences (default enabled tools, etc.)
 */
export interface ToolPreferences {
  defaultToolsEnabled: string[];
  lastUsedTools: string[];
}

/**
 * Load tool preferences
 */
export function loadToolPreferences(): ToolPreferences {
  try {
    const stored = localStorage.getItem(TOOL_PREFERENCES_KEY);
    if (!stored) {
      return {
        defaultToolsEnabled: [],
        lastUsedTools: [],
      };
    }

    return JSON.parse(stored) as ToolPreferences;
  } catch (err) {
    console.error('Failed to load tool preferences:', err);
    return {
      defaultToolsEnabled: [],
      lastUsedTools: [],
    };
  }
}

/**
 * Save tool preferences
 */
export function saveToolPreferences(preferences: ToolPreferences): void {
  try {
    localStorage.setItem(TOOL_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.error('Failed to save tool preferences:', err);
  }
}
