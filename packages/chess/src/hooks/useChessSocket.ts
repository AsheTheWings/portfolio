'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChessWsTicket } from '../lib/chess-api';
import type { ChessClientMessage, ChessServerMessage } from '../types/protocol';

export type ChessConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

interface UseChessSocketOptions {
  gameId: string | null;
  onMessage: (message: ChessServerMessage) => void;
}

/**
 * Maintains a per-game chess WebSocket subscription.
 *
 * @param options - Game id and message callback.
 * @returns Connection state and typed send function.
 */
export function useChessSocket({ gameId, onMessage }: UseChessSocketOptions) {
  const [connectionState, setConnectionState] = useState<ChessConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlerRef = useRef(onMessage);
  const queueRef = useRef<ChessClientMessage[]>([]);

  useEffect(() => {
    messageHandlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!gameId) {
      setConnectionState('disconnected');
      return;
    }

    const subscribedGameId = gameId;
    let cancelled = false;
    let ws: WebSocket | null = null;

    async function connect() {
      setConnectionState('connecting');
      try {
        const ticket = await fetchChessWsTicket();
        if (cancelled) return;
        ws = new WebSocket(`${WS_URL}/chess/ws?ticket=${encodeURIComponent(ticket)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('connected');
          ws?.send(JSON.stringify({ type: 'subscribe_game', gameId: subscribedGameId } satisfies ChessClientMessage));
          const queued = queueRef.current;
          queueRef.current = [];
          for (const message of queued) ws?.send(JSON.stringify(message));
        };

        ws.onmessage = (event) => {
          try {
            messageHandlerRef.current(JSON.parse(event.data) as ChessServerMessage);
          } catch {
            messageHandlerRef.current({ type: 'error', gameId: subscribedGameId, error: 'Received malformed chess event' });
          }
        };

        ws.onclose = () => {
          if (!cancelled) setConnectionState('disconnected');
        };

        ws.onerror = () => {
          if (!cancelled) setConnectionState('error');
        };
      } catch (err) {
        if (!cancelled) {
          setConnectionState('error');
          messageHandlerRef.current({ type: 'error', gameId: subscribedGameId, error: err instanceof Error ? err.message : 'Chess WebSocket failed' });
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe_game', gameId: subscribedGameId } satisfies ChessClientMessage));
      }
      ws?.close(1000, 'Chess view closed');
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [gameId]);

  const send = useCallback((message: ChessClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return;
    }
    queueRef.current.push(message);
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    send,
  };
}
