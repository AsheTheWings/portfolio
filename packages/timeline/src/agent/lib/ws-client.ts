'use client';

import { AgentClient } from '@agentime/client';
import type { ConnectionState as ClientConnectionState } from '@agentime/client';
import type { ClientMessage, ServerMessage } from '@agentime/protocol';
import { LocalMcpHttpToolProvider } from './mcp-client';
import { loadMcpConfig } from '../utils/mcp-config';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

export class AgentWsClient {
  private client: AgentClient;
  private mcpProvider: LocalMcpHttpToolProvider | null = null;
  private stateListeners = new Set<(state: ConnectionState) => void>();

  constructor(wsUrl: string) {
    this.client = new AgentClient({
      resolveUrl: async () => {
        const res = await fetch('/api/agent/ws-ticket', { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          throw new Error(`ws-ticket fetch failed: HTTP ${res.status}`);
        }
        const data = await res.json();
        return `${wsUrl}/ws?ticket=${encodeURIComponent(data.ticket)}`;
      },
    });

    // Listen to state changes to map them for stateListeners
    this.client.onStateChange((state, error) => {
      const mapped = state === 'negotiating' ? 'connecting' : state;
      for (const listener of this.stateListeners) {
        try {
          listener(mapped);
        } catch (e) {}
      }
    });
  }

  getClientInstance(): AgentClient {
    return this.client;
  }

  async connect(): Promise<void> {
    if (!this.mcpProvider) {
      const config = loadMcpConfig();
      this.mcpProvider = new LocalMcpHttpToolProvider(config);
      await this.client.registry.registerProvider(this.mcpProvider);
    }
    this.client.connect();
  }

  disconnect(): void {
    this.client.disconnect();
  }

  destroy(): void {
    this.client.destroy();
    this.stateListeners.clear();
  }

  send(msg: ClientMessage): void {
    this.client.send(msg);
  }

  on(type: ServerMessage['type'], handler: (msg: any) => void): () => void {
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
    const state = this.client.getState();
    return state === 'negotiating' ? 'connecting' : state;
  }

  async updateMcpConfig(config: any): Promise<void> {
    if (this.mcpProvider) {
      await this.client.registry.unregisterProvider(this.mcpProvider.id);
    }
    this.mcpProvider = new LocalMcpHttpToolProvider(config);
    await this.client.registry.registerProvider(this.mcpProvider);
  }
}
