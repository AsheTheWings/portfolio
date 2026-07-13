/**
 * MCP Configuration Management
 * LocalStorage utilities for MCP config
 */

import type { McpConfig } from '../types';

const MCP_CONFIG_KEY = 'timeline:agent:mcpConfig';
const TOOL_PREFERENCES_KEY = 'timeline:agent:toolPreferences';

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

    const config = JSON.parse(stored) as McpConfig;
    return {
      ...getDefaultMcpConfig(),
      ...config,
    };
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
    const safeServers = (config.servers || []).map((s: any) => ({ name: s.name }));
    const safeConfig = {
      enabled: config.enabled,
      port: config.port,
      servers: safeServers,
      pairingToken: config.pairingToken,
    };
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
