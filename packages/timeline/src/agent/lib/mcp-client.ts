/**
 * LocalMcpHttpToolProvider - localhost MCP integration as a ClientToolProvider adapter
 */

import type { ClientToolProvider } from '@agentime/client/tools';
import {
  ClientToolDescriptorSchema,
  JsonValueSchema,
  MAX_CLIENT_CATALOG_SIZE,
  type ClientToolDescriptor,
  type JsonValue,
} from '@agentime/protocol';
import type { McpConfig, McpHostStatus, McpClientStatus } from '../types/tools';
import { normalizeMcpConfig } from '../utils/mcp-config';

const MAX_ERROR_RESPONSE_BYTES = 64_000;
const MAX_TOOL_CATALOG_RESPONSE_BYTES = 2_000_000;
const MAX_EXECUTION_RESPONSE_BYTES = 5_000_000;

async function readBoundedJson(response: Response, limit: number): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Error('Local MCP response size limit exceeded');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Local MCP response has no body');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new Error('Local MCP response size limit exceeded');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class LocalMcpHttpToolProvider implements ClientToolProvider {
  readonly id = 'local-mcp';
  private tools: ClientToolDescriptor[] = [];
  private listeners = new Set<(tools: readonly ClientToolDescriptor[]) => void>();
  private hostStatus: McpHostStatus = 'notConnected';
  private clientStatus: McpClientStatus = 'notConnected';
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: McpConfig,
    private onStatusChange?: (hostStatus: McpHostStatus, clientStatus: McpClientStatus) => void
  ) {
    this.config = normalizeMcpConfig(config);
  }

  private readonly config: McpConfig;

  private baseUrl(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }

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
      
      const baseUrl = this.baseUrl();
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
        const baseUrl = this.baseUrl();
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
    call: { sessionId: string; runId: string; requestId: string; server: string; tool: string; arguments: Record<string, JsonValue> },
    context: { signal: AbortSignal }
  ): Promise<JsonValue> {
    if (!this.config.enabled || !this.config.pairingToken) {
      throw new Error('Local MCP provider is disabled or not paired');
    }

    const baseUrl = this.baseUrl();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.pairingToken}`,
    };

    // Timeout signal for R70: local-host adapter must apply timeouts and response-size validation
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(30_000)]);

    const response = await fetch(`${baseUrl}/mcp/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        server: call.server,
        tool: call.tool,
        arguments: call.arguments,
      }),
      signal,
    });

    if (!response.ok) {
      const payload = await readBoundedJson(response, MAX_ERROR_RESPONSE_BYTES).catch(() => undefined);
      const error = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).error
        : undefined;
      throw new Error(typeof error === 'string' && error.length <= 1_000
        ? error
        : `Execution failed with status ${response.status}`);
    }

    const parsed = await readBoundedJson(response, MAX_EXECUTION_RESPONSE_BYTES);
    const result = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).result
      : undefined;
    return JsonValueSchema.parse(result);
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
    const baseUrl = this.baseUrl();
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

    const data = await readBoundedJson(res, MAX_TOOL_CATALOG_RESPONSE_BYTES);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Local MCP tool catalog response is invalid');
    }
    const serverInfo = (data as Record<string, unknown>).servers;
    if (!serverInfo || typeof serverInfo !== 'object' || Array.isArray(serverInfo)) {
      throw new Error('Local MCP tool catalog response is invalid');
    }
    const discovered: ClientToolDescriptor[] = [];

    for (const [serverName, rawServerData] of Object.entries(serverInfo)) {
      if (!rawServerData || typeof rawServerData !== 'object' || Array.isArray(rawServerData)) {
        throw new Error('Local MCP server catalog is invalid');
      }
      const rawTools = (rawServerData as Record<string, unknown>).tools ?? [];
      if (!Array.isArray(rawTools)) throw new Error('Local MCP server tools are invalid');
      for (const rawTool of rawTools) {
        if (discovered.length >= MAX_CLIENT_CATALOG_SIZE) {
          throw new Error('Local MCP tool catalog exceeds the configured limit');
        }
        if (!rawTool || typeof rawTool !== 'object' || Array.isArray(rawTool)) {
          throw new Error('Local MCP tool descriptor is invalid');
        }
        const tool = rawTool as Record<string, unknown>;
        discovered.push(ClientToolDescriptorSchema.parse({
          server: serverName,
          tool: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema ?? {},
        }));
      }
    }

    this.tools = discovered;
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener([...this.tools]);
      } catch {}
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
        const baseUrl = this.baseUrl();
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
      } catch {
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
