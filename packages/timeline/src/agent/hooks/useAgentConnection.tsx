'use client';

/**
 * useAgentConnection — React hook wrapping the WS client.
 *
 * Provides connection state, correlated commands, and typed subscriptions.
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
import type { WsServerMessage } from '../types/protocol';
import { useAgentStore } from '../stores/useAgentStore';
import type {
  AgentCommandInput,
  CommandSuccessMessage,
} from '@agentime/client';

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
    clientRef.current = new AgentWsClient(
      WS_URL,
      (diagnostic) => {
        const store = useAgentStore.getState();
        store.setConnectionProblem({
          ...store.connectionProblem,
          status: diagnostic.code === 'CONNECTION_FAILED' || diagnostic.code === 'WEBSOCKET_FAILED'
            ? 'error'
            : store.connectionProblem.status,
          diagnostic: {
            code: diagnostic.code,
            message: diagnostic.message,
            observedAt: new Date().toISOString(),
          },
        });
        if (diagnostic.code === 'TOOL_CATALOG_FAILED') {
          store.setLocalMcpProblem({
            id: 'local-mcp:catalog:host',
            code: 'MCP_CATALOG_REJECTED',
            message: 'The delegated MCP tool catalog was rejected.',
            operation: 'catalog',
            retryable: true,
            recoveryActions: ['retry', 'inspect_mcp_configuration'],
            observedAt: new Date().toISOString(),
          });
        }
      },
      (hostStatus, clientStatus) => {
        useAgentStore.getState().setMcpStatus(hostStatus, clientStatus);
      },
      (problem) => {
        useAgentStore.getState().setLocalMcpProblem(problem);
      },
    );
  }
  const client = clientRef.current;

  useEffect(() => {
    const wsClient = clientRef.current!;
    const unsub = wsClient.onStateChange((state) => {
      setConnectionState(state);
      const store = useAgentStore.getState();
      store.setConnectionProblem({
        status: state,
        problemDiagnosticId: state === 'connected'
          ? null
          : store.connectionProblem.problemDiagnosticId,
        diagnostic: state === 'connected'
          ? null
          : store.connectionProblem.diagnostic,
      });
    });
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
      for (const rejection of msg.rejected) {
        useAgentStore.getState().setLocalMcpProblem({
          id: `local-mcp:catalog:${rejection.server}:${rejection.tool}`,
          code: 'MCP_CATALOG_REJECTED',
          message: `The MCP tool ${rejection.server}/${rejection.tool} was not accepted.`,
          operation: 'catalog',
          server: rejection.server,
          retryable: true,
          recoveryActions: ['retry', 'inspect_mcp_configuration'],
          observedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      unsub();
      unsubAck();
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

  const command = useCallback(
    (message: AgentCommandInput): Promise<CommandSuccessMessage> =>
      client.command(message),
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
    command,
    subscribe,
    client,
  };
}
