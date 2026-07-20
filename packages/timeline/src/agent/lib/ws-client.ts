'use client';

import { AgentClient } from '@agentime/client';
import type {
  AgentCommandInput,
  AgentClientDiagnostic,
  AgentimeProblemOccurrence,
  CommandSuccessMessage,
} from '@agentime/client';
import type {
  ServerMessage,
} from '@agentime/protocol';
import type { McpConfig } from '../types';
import type {
  LocalMcpProblem,
} from '../problems/types';
import type { McpClientStatus, McpHostStatus } from '../types/tools';
import { LocalMcpHttpToolProvider } from './mcp-client';
import { loadMcpConfig } from '../utils/mcp-config';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

export class AgentWsClient {
  private client: AgentClient;
  private mcpProvider: LocalMcpHttpToolProvider | null = null;
  private mcpRegistration: Promise<void> | null = null;
  private state: ConnectionState = 'disconnected';
  private stateListeners = new Set<(state: ConnectionState) => void>();

  constructor(
    wsUrl: string,
    onDiagnostic?: (diagnostic: AgentClientDiagnostic) => void,
    private onMcpStatus?: (
      hostStatus: McpHostStatus,
      clientStatus: McpClientStatus,
    ) => void,
    private onMcpProblem?: (problem: LocalMcpProblem) => void,
  ) {
    this.client = new AgentClient({
      resolveUrl: async () => {
        const res = await fetch('/api/auth/ws-ticket', { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          throw new Error(`ws-ticket fetch failed: HTTP ${res.status}`);
        }
        const data = await res.json();
        return `${wsUrl.replace(/\/+$/, '')}/agent/ws?ticket=${encodeURIComponent(data.ticket)}`;
      },
      onDiagnostic,
    });

    this.client.onStateChange((state, error) => {
      this.publishState(error ? 'error' : state === 'negotiating' ? 'connecting' : state);
    });
  }

  getClientInstance(): AgentClient {
    return this.client;
  }

  async connect(): Promise<void> {
    this.client.connect();
    try {
      await this.ensureMcpProvider();
    } catch {
      // A local tool extension is optional and cannot prevent the server
      // connection. The registry has already removed its failed catalog.
    }
  }

  disconnect(): void {
    this.client.disconnect();
    this.publishState('disconnected');
  }

  async destroy(): Promise<void> {
    await this.client.destroy();
    this.mcpProvider = null;
    this.mcpRegistration = null;
    this.stateListeners.clear();
  }

  command(message: AgentCommandInput): Promise<CommandSuccessMessage> {
    return this.client.command(message);
  }

  onProblem(handler: (occurrence: AgentimeProblemOccurrence) => void): () => void {
    return this.client.onProblem(handler);
  }

  on<TType extends ServerMessage['type']>(
    type: TType,
    handler: (msg: Extract<ServerMessage, { type: TType }>) => void,
  ): () => void {
    return this.client.onMessage(type, handler);
  }

  onAny(handler: (msg: ServerMessage) => void): () => void {
    return this.client.onAnyMessage(handler);
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(handler);
    // call immediately with current mapped state
    const current = this.getState();
    handler(current);
    return () => {
      this.stateListeners.delete(handler);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  async updateMcpConfig(config: McpConfig): Promise<void> {
    await this.mcpRegistration?.catch(() => {});
    if (this.mcpProvider) {
      await this.client.registry.unregisterProvider(this.mcpProvider.id);
    }
    const provider = this.createMcpProvider(config);
    this.mcpProvider = provider;
    const registration = this.client.registry.registerProvider(provider);
    this.mcpRegistration = registration;
    try {
      await registration;
    } catch (error) {
      if (this.mcpProvider === provider) this.mcpProvider = null;
      throw error;
    } finally {
      if (this.mcpRegistration === registration) this.mcpRegistration = null;
    }
  }

  private async ensureMcpProvider(): Promise<void> {
    if (this.mcpRegistration) return this.mcpRegistration;
    if (this.mcpProvider) return;
    const provider = this.createMcpProvider(loadMcpConfig());
    this.mcpProvider = provider;
    const registration = this.client.registry.registerProvider(provider);
    this.mcpRegistration = registration;
    try {
      await registration;
    } catch (error) {
      if (this.mcpProvider === provider) this.mcpProvider = null;
      throw error;
    } finally {
      if (this.mcpRegistration === registration) this.mcpRegistration = null;
    }
  }

  private publishState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch {}
    }
  }

  private createMcpProvider(config: McpConfig): LocalMcpHttpToolProvider {
    try {
      return new LocalMcpHttpToolProvider(
        config,
        this.onMcpStatus,
        this.onMcpProblem,
      );
    } catch (error) {
      this.onMcpProblem?.({
        id: crypto.randomUUID(),
        code: 'MCP_CONFIGURATION_INVALID',
        message: 'The local MCP configuration is invalid.',
        operation: 'configuration',
        retryable: false,
        recoveryActions: ['inspect_mcp_configuration'],
        observedAt: new Date().toISOString(),
      });
      throw error;
    }
  }
}
