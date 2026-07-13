/**
 * LocalMcpHttpToolProvider - localhost MCP integration as a ClientToolProvider adapter
 */

import type { ClientToolProvider } from '@agentime/client/tools';
import type { ClientToolDescriptor } from '@agentime/protocol';
import type { McpHostStatus, McpClientStatus } from '../types/tools';

export class LocalMcpHttpToolProvider implements ClientToolProvider {
  readonly id = 'local-mcp';
  private tools: ClientToolDescriptor[] = [];
  private listeners = new Set<(tools: readonly ClientToolDescriptor[]) => void>();
  private hostStatus: McpHostStatus = 'notConnected';
  private clientStatus: McpClientStatus = 'notConnected';
  private healthCheckInterval: any = null;

  constructor(
    private config: {
      enabled: boolean;
      port: number;
      servers: { name: string }[];
      pairingToken?: string;
    },
    private onStatusChange?: (hostStatus: McpHostStatus, clientStatus: McpClientStatus) => void
  ) {}

  getTools(): readonly ClientToolDescriptor[] {
    return this.tools;
  }

  async connect(): Promise<void> {
    if (!this.config.enabled) return;
    
    // R67: fail closed without pairing
    if (!this.config.pairingToken) {
      this.setHostStatus('error');
      this.setClientStatus('notConnected');
      throw new Error('MCP pairing token is required');
    }

    try {
      this.setClientStatus('connecting');
      
      const baseUrl = `http://localhost:${this.config.port}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.pairingToken}`,
      };

      // 1. Health check
      const healthRes = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(1000),
      });

      if (!healthRes.ok) {
        throw new Error('MCP host health check failed');
      }

      this.setHostStatus('connected');

      // 2. Connect servers - R69: do not send command, args, or env definitions! Only send server names.
      const connectRes = await fetch(`${baseUrl}/mcp/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          servers: this.config.servers.map(s => ({ name: s.name }))
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!connectRes.ok) {
        throw new Error('Failed to connect servers');
      }

      // 3. Discover tools
      await this.refreshToolsInternal();

      this.setClientStatus('connected');
    } catch (err) {
      this.setHostStatus('error');
      this.setClientStatus('notConnected');
      this.tools = [];
      this.notifyListeners();
      throw err;
    } finally {
      this.startHealthCheck();
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    try {
      if (this.hostStatus === 'connected' && this.config.pairingToken) {
        const baseUrl = `http://localhost:${this.config.port}`;
        const headers = {
          'Authorization': `Bearer ${this.config.pairingToken}`,
        };
        await fetch(`${baseUrl}/mcp/disconnect`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      }
    } finally {
      this.setHostStatus('notConnected');
      this.setClientStatus('notConnected');
      this.tools = [];
      this.notifyListeners();
    }
  }

  async execute(
    call: { sessionId: string; runId: string; requestId: string; server: string; tool: string; arguments: Record<string, any> },
    context: { signal: AbortSignal }
  ): Promise<unknown> {
    if (!this.config.enabled || !this.config.pairingToken) {
      throw new Error('Local MCP provider is disabled or not paired');
    }

    const baseUrl = `http://localhost:${this.config.port}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.pairingToken}`,
    };

    // Timeout signal for R70: local-host adapter must apply timeouts and response-size validation
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 30000); // 30s timeout

    const onAbort = () => timeoutController.abort();
    context.signal.addEventListener('abort', onAbort);

    try {
      const response = await fetch(`${baseUrl}/mcp/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          server: call.server,
          tool: call.tool,
          arguments: call.arguments,
        }),
        signal: timeoutController.signal, // propagates cancellation (R66)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Unknown execution error' }));
        throw new Error(errJson.error || `Execution failed with status ${response.status}`);
      }

      // R70: Response size validation
      const limit = 5_000_000; // 5MB limit
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let totalBytes = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > limit) {
          throw new Error('Response size limit exceeded');
        }
        chunks.push(value);
      }

      const totalBuffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        totalBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(totalBuffer);
      const parsed = JSON.parse(text);
      return parsed.result;
    } finally {
      clearTimeout(timeoutId);
      context.signal.removeEventListener('abort', onAbort);
    }
  }

  subscribeCatalog(listener: (tools: readonly ClientToolDescriptor[]) => void): () => void {
    this.listeners.add(listener);
    // Call immediately
    listener([...this.tools]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getHostStatus() {
    return this.hostStatus;
  }

  getClientStatus() {
    return this.clientStatus;
  }

  private async refreshToolsInternal() {
    const baseUrl = `http://localhost:${this.config.port}`;
    const headers = {
      'Authorization': `Bearer ${this.config.pairingToken}`,
    };

    const res = await fetch(`${baseUrl}/mcp/tools`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      throw new Error('Failed to discover tools');
    }

    const data = await res.json();
    const serverInfo = data.servers || {};
    const discovered: ClientToolDescriptor[] = [];

    for (const [serverName, serverData] of Object.entries(serverInfo) as any) {
      for (const tool of serverData.tools || []) {
        discovered.push({
          server: serverName,
          tool: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
        });
      }
    }

    this.tools = discovered;
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener([...this.tools]);
      } catch (e) {}
    }
  }

  private startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      if (!this.config.enabled || !this.config.pairingToken) {
        this.stopHealthCheck();
        return;
      }

      try {
        const baseUrl = `http://localhost:${this.config.port}`;
        const headers = {
          'Authorization': `Bearer ${this.config.pairingToken}`,
        };

        const res = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(1000),
        });

        if (!res.ok) {
          throw new Error('Unhealthy');
        }

        if (this.hostStatus !== 'connected') {
          await this.connect();
        }
      } catch (e) {
        if (this.hostStatus === 'connected') {
          this.setHostStatus('error');
          this.setClientStatus('notConnected');
          this.tools = [];
          this.notifyListeners();
        }
      }
    }, 6000);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private setHostStatus(status: McpHostStatus) {
    if (this.hostStatus !== status) {
      this.hostStatus = status;
      this.onStatusChange?.(this.hostStatus, this.clientStatus);
    }
  }

  private setClientStatus(status: McpClientStatus) {
    if (this.clientStatus !== status) {
      this.clientStatus = status;
      this.onStatusChange?.(this.hostStatus, this.clientStatus);
    }
  }
}

// Keep McpClient class as a wrapper for backward compatibility if needed by the UI
export class McpClient extends LocalMcpHttpToolProvider {
  constructor(config: any, onStatusChange?: any) {
    super(config, onStatusChange);
  }
}
