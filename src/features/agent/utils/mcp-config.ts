/**
 * MCP Configuration Management
 * LocalStorage utilities for MCP config
 */

import type { McpConfig } from '../types';

const MCP_CONFIG_KEY = 'timeline:mcp:config';
const TOOL_PREFERENCES_KEY = 'timeline:tools:preferences';

/**
 * Default MCP configuration
 */
export function getDefaultMcpConfig(): McpConfig {
  return {
    enabled: false,
    port: 8765,
    servers: [
      {
        name: 'image-analysis',
        command: '.venv\\Scripts\\python',
        args: ['-m', 'mcp_servers.image_analysis'],
        env: {
          PYTHONPATH: 'e:\\code\\id_11\\timeline\\dev\\mcp_host',
          WEB_API_URL: 'http://localhost:3000/api/agent/call-model',
        },
      },
      {
        name: 'context7',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp@latest'],
        env: {},
      },
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
    localStorage.setItem(MCP_CONFIG_KEY, JSON.stringify(config));
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
