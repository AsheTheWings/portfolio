'use client';

/**
 * useAgentConnection — React hook wrapping the WS client.
 *
 * Provides connection state, send(), and typed event subscription.
 * The underlying AgentWsClient is created once in AgentConnectionProvider
 * and shared via React context.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { AgentWsClient, type ConnectionState } from '../lib/ws-client';
import type { WsClientMessage, WsServerMessage } from '../types/protocol';
import { useAgentStore } from '../stores/useAgentStore';
import type { LocalMcpHttpToolProvider } from '../lib/mcp-client';
import { toastError } from '@portfolio/ui/components/FeedbackMessage';

// ============================================================
// Context
// ============================================================

interface AgentConnectionContextValue {
  client: AgentWsClient;
  connectionState: ConnectionState;
}

const AgentConnectionContext = createContext<AgentConnectionContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

interface AgentConnectionProviderProps {
  children: ReactNode;
}

export function AgentConnectionProvider({ children }: AgentConnectionProviderProps) {
  const clientRef = useRef<AgentWsClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // Create client once
  if (!clientRef.current) {
    clientRef.current = new AgentWsClient(WS_URL);
  }
  const client = clientRef.current;

  useEffect(() => {
    const wsClient = clientRef.current!;
    const unsub = wsClient.onStateChange(setConnectionState);
    void wsClient.connect();

    // Listen to delegated_tool_catalog_ack to update selectable tools and rejected tools (R61 & R62)
    const unsubAck = wsClient.on('delegated_tool_catalog_ack', (msg) => {
      const baseTools = useAgentStore.getState().toolsPool.filter(t => t.source !== 'delegated');
      const delegatedToolsInRegistry = wsClient.getClientInstance().registry.getMergedCatalog();
      
      const acceptedTools = msg.accepted.map((acc) => {
        const found = delegatedToolsInRegistry.find(t => t.server === acc.server && t.tool === acc.tool);
        return {
          server: acc.server,
          tool: acc.tool,
          description: found?.description || "",
          inputSchema: found?.inputSchema || {},
          source: 'delegated' as const
        };
      });

      useAgentStore.getState().setToolsPool([...baseTools, ...acceptedTools]);
      useAgentStore.getState().setRejectedTools(msg.rejected || []);
    });

    // Listen to MCP provider status changes to update Zustand store
    const updateMcpStatus = () => {
      const mcpProvider = wsClient.getClientInstance().registry.getProviders().find(p => p.id === 'local-mcp') as LocalMcpHttpToolProvider | undefined;
      if (mcpProvider) {
        useAgentStore.getState().setMcpStatus(mcpProvider.getHostStatus(), mcpProvider.getClientStatus());
      }
    };
    
    // Periodically update status or set it on state change
    const statusInterval = setInterval(updateMcpStatus, 1000);

    return () => {
      unsub();
      unsubAck();
      clearInterval(statusInterval);
      // Use disconnect() instead of destroy() to survive React Strict Mode
      // double-invoke (mount → cleanup → remount). The client stays alive
      // so the next mount's connect() can reuse it.
      wsClient.disconnect();
    };
  }, []);

  return (
    <AgentConnectionContext.Provider value={{ client, connectionState }}>
      {children}
    </AgentConnectionContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useAgentConnection() {
  const ctx = useContext(AgentConnectionContext);
  if (!ctx) throw new Error('useAgentConnection must be used within AgentConnectionProvider');

  const { client, connectionState } = ctx;

  const send = useCallback(
    (msg: WsClientMessage) => {
      try {
        client.send(msg);
      } catch (err: unknown) {
        toastError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [client],
  );

  /**
   * Subscribe to a specific server message type.
   * Returns an unsubscribe function.
   */
  const subscribe = useCallback(
    (type: WsServerMessage['type'], handler: (msg: WsServerMessage) => void) =>
      client.on(type, handler),
    [client],
  );

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    send,
    subscribe,
    client,
  };
}
