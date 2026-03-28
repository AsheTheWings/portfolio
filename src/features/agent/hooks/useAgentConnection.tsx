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
    const unsub = client.onStateChange(setConnectionState);
    client.connect();

    return () => {
      unsub();
      client.destroy();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    (msg: WsClientMessage) => client.send(msg),
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
