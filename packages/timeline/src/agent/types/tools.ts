import type { AgentConfig, AgentMetadata } from './session';

// Tool handler function type
export type ToolHandler = (
  args: Record<string, unknown>,
  context: {
    agentConfig?: AgentConfig;
    userFeedback?: unknown;
    toolCallEventId?: string;
    metadata?: AgentMetadata;  // Read-only snapshot of turn metadata at call time
    interactionId?: string;           // Turn ID from session context
    turnMetadata?: AgentMetadata;  // Turn-scoped metadata for job aggregation
  }
) => Promise<unknown>;

// MCP Tools definition
export interface Tool {
  server: string;
  tool: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source: 'builtin' | 'managed' | 'delegated';
  handler?: ToolHandler;  // Built-in tools provide their own handler
}

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
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// MCP client configuration
export interface McpConfig {
  enabled: boolean;
  port: number;
  servers: McpServerConfig[];
}
