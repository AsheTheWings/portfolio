/**
 * McpClient - MCP Host Connection Manager
 * Manages connection to local MCP host service
 * Handles tool discovery and execution routing
 */

import type { Tool, McpConfig, McpHostStatus, McpClientStatus, McpServerInfo } from '../types';

type StatusChangeCallback = (hostStatus: McpHostStatus, clientStatus: McpClientStatus) => void;

export class McpClient {
  private config: McpConfig;
  private hostStatus: McpHostStatus = 'notConnected';
  private clientStatus: McpClientStatus = 'notConnected';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private tools: Tool[] = [];
  private serverInfo: Record<string, McpServerInfo> = {};
  private baseUrl: string;
  private onStatusChange?: StatusChangeCallback;

  constructor(config: McpConfig, onStatusChange?: StatusChangeCallback) {
    this.config = config;
    this.baseUrl = `http://localhost:${config.port}`;
    this.onStatusChange = onStatusChange;
  }

  /**
   * Connect to MCP host and discover tools
   */
  async connect(): Promise<void> {
    try {
      // Health check
      const healthResponse = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });

      if (!healthResponse.ok) {
        throw new Error('MCP host health check failed');
      }

      // HTTP reachability confirmed - set host status to connected
      this.setHostStatus('connected');

      // Connect and initialize servers
      this.setClientStatus('connecting');
      const connectResponse = await fetch(`${this.baseUrl}/mcp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: this.config.servers }),
        signal: AbortSignal.timeout(60000),
      });

      if (!connectResponse.ok) {
        const error = await connectResponse.json().catch(() => ({ error: 'Connection failed' }));
        throw new Error(error.error || 'Failed to connect to MCP host');
      }

      // Fetch available tools (non-blocking)
      // Tool retrieval failure doesn't affect connection status
      try {
        await this.refreshTools();
      } catch (toolErr: unknown) {
        this.tools = [];
      }

      // Set client status to connected AFTER tools are fetched
      this.setClientStatus('connected');
    } catch (err: unknown) {
      this.setHostStatus('error');
      this.setClientStatus('notConnected');
      throw err;
    } finally {
      this.startHealthCheck();
    }
  }

  /**
   * Disconnect from MCP host
   */
  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    try {
      // Only attempt disconnect if host is reachable
      if (this.hostStatus === 'connected') {
        await fetch(`${this.baseUrl}/mcp/disconnect`, {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
        })
      }
    } finally {
      this.setHostStatus('notConnected');
      this.setClientStatus('notConnected');
      this.tools = [];
      this.serverInfo = {};
    }
  }

  /**
   * Refresh tool list from MCP host
   * Parses new server-grouped structure and flattens to tools array
   */
  async refreshTools(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/mcp/tools`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tools from MCP host');
    }

    const data = await response.json();
    this.serverInfo = data.servers || {};
    
    // Flatten server-grouped tools into tools array
    this.tools = [];
    for (const [serverName, serverData] of Object.entries(this.serverInfo)) {
      for (const tool of serverData.tools) {
        this.tools.push({
          server: serverName,
          tool: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          source: 'custom',
        });
      }
    }
  }

  /**
   * Execute tool via MCP host
   */
  async executeTool(
    server: string,
    tool: string,
    args: Record<string, unknown>,
    timeout: number = 60000
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, tool, arguments: args }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Tool execution failed' }));
      throw new Error(error.error || `Tool execution failed: ${response.status}`);
    }

    const result = await response.json();
    return result.result;
  }

  /**
   * Get current tools list
   */
  getTools(): Tool[] {
    return [...this.tools];
  }

  /**
   * Get server info for all configured servers
   */
  getServerInfo(): Record<string, McpServerInfo> {
    return { ...this.serverInfo };
  }

  /**
   * Get host status
   */
  getHostStatus(): McpHostStatus {
    return this.hostStatus;
  }

  /**
   * Get client status
   */
  getClientStatus(): McpClientStatus {
    return this.clientStatus;
  }

  /**
   * Get configuration
   */
  getConfig(): McpConfig {
    return { ...this.config };
  }

  /**
   * Update enabled flag (stops health check if disabled)
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopHealthCheck();
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    this.stopHealthCheck(); // Clear any existing interval

    this.healthCheckInterval = setInterval(async () => {
      // Stop health check if MCP is disabled
      if (!this.config.enabled) {
        this.stopHealthCheck();
        return;
      }

      try {
        const response = await fetch(`${this.baseUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(500),
        });

        if (!response.ok) {
          throw new Error('Health check failed');
        }

        // If host is available and we're disconnected, attempt reconnection
        if (this.hostStatus === 'error' || this.hostStatus === 'notConnected') {
          try {
            await this.connect();
          } catch (reconnectErr: unknown) {
            // Auto-reconnection failed, will retry on next health check
          }
        }
      } catch (err) {
        if (this.hostStatus === 'connected') {
          // Clear state first
          this.tools = [];
          this.serverInfo = {};
          
          // Update client status before host status to ensure callback sees correct state
          this.setClientStatus('notConnected');
          this.setHostStatus('error');
        }
      }
    }, 6000);
  }

  /**
   * Stop health check polling
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Update host status and notify callback
   */
  private setHostStatus(status: McpHostStatus): void {
    if (this.hostStatus !== status) {
      this.hostStatus = status;
      this.onStatusChange?.(this.hostStatus, this.clientStatus);
    }
  }

  /**
   * Update client status and notify callback
   */
  private setClientStatus(status: McpClientStatus): void {
    if (this.clientStatus !== status) {
      this.clientStatus = status;
      this.onStatusChange?.(this.hostStatus, this.clientStatus);
    }
  }
}
