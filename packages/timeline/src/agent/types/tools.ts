import type { ToolDescriptor } from '@agentime/protocol';

export type Tool = ToolDescriptor;

// MCP host status (HTTP reachability of MCP host service)
export type McpHostStatus = 'notConnected' | 'connected' | 'error';

// MCP client status (status of individual MCP server connections)
export type McpClientStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'notConnected';

// MCP tool info (compact format from server)
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// MCP server info from tools endpoint
export interface McpServerInfo {
  status: 'connected' | 'error';
  error: string | null;
  tools: McpToolInfo[];
}

// MCP server configuration
export interface McpServerConfig {
  name: string;
  command?: never;
  args?: never;
  env?: never;
}

// MCP client configuration
export interface McpConfig {
  enabled: boolean;
  port: number;
  servers: McpServerConfig[];
  pairingToken?: string;
}
