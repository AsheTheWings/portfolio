'use client';

/**
 * Agent WebSocket Client
 *
 * Framework-agnostic class managing the WS lifecycle.
 * Single connection per page — shared via React context.
 *
 * Auth flow:
 *  1. Fetch one-time ticket via POST /api/agent/ws-ticket (goes through Next.js proxy)
 *  2. Connect to ws(s)://BACKEND/ws?ticket=<ticket>
 *
 * Features:
 *  - Auto-reconnect with exponential backoff (1s → 30s)
 *  - Outbound message queuing while disconnected
 *  - Typed handlers for each ServerMessage type
 *  - Re-subscribes to active sessions on reconnect
 */

import type {
  WsClientMessage,
  WsServerMessage,
  WsSessionEventMessage,
  WsSessionCreatedMessage,
  WsWorkflowStartedAckMessage,
  WsExecuteDelegatedToolMessage,
  WsCancelDelegatedToolMessage,
  WsSessionBranchedMessage,
  WsErrorMessage,
} from '../types/protocol';

// ============================================================
// Types
// ============================================================

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Map server message type strings to their concrete message interfaces */
interface ServerMessageMap {
  session_event: WsSessionEventMessage;
  session_created: WsSessionCreatedMessage;
  workflow_started_ack: WsWorkflowStartedAckMessage;
  execute_delegated_tool: WsExecuteDelegatedToolMessage;
  cancel_delegated_tool: WsCancelDelegatedToolMessage;
  session_branched: WsSessionBranchedMessage;
  error: WsErrorMessage;
}

type MessageHandler<T = WsServerMessage> = (msg: T) => void;
type StateHandler = (state: ConnectionState) => void;

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

// ============================================================
// AgentWsClient
// ============================================================

// Internal type for heterogeneous handler storage (handlers are typed at the public API boundary)
type AnyMessageHandler = MessageHandler;

export class AgentWsClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private handlers = new Map<string, Set<AnyMessageHandler>>();
  private wildcardHandlers = new Set<MessageHandler>();
  private stateListeners = new Set<StateHandler>();
  private messageQueue: WsClientMessage[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private activeSubscriptions = new Set<string>();
  private connectGeneration = 0;

  constructor(private wsUrl: string) {}

  // ----------------------------------------------------------
  // Connection lifecycle
  // ----------------------------------------------------------

  async connect(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.setState('connecting');

    const generation = ++this.connectGeneration;

    // Fetch one-time ticket via proxy
    let ticket: string;
    try {
      const res = await fetch('/api/agent/ws-ticket', { method: 'POST', credentials: 'include' });

      // Abort if disconnect/destroy was called during the fetch
      if (generation !== this.connectGeneration || this.destroyed) {
        return;
      }

      if (!res.ok) {
        console.error(`[WS-Client] connect() ticket fetch failed: HTTP ${res.status} — scheduling reconnect`);
        this.setState('error');
        this.scheduleReconnect();
        return;
      }
      const data = await res.json();
      ticket = data.ticket;
    } catch (err) {
      if (generation !== this.connectGeneration || this.destroyed) return;
      console.error('[WS-Client] connect() ticket fetch threw:', err);
      this.setState('error');
      this.scheduleReconnect();
      return;
    }

    const url = `${this.wsUrl}/ws?ticket=${encodeURIComponent(ticket)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.drainQueue();
      this.resubscribe();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data);
        this.dispatch(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      this.ws = null;
      if (!this.destroyed && event.code !== 1000) {
        // Unexpected close — reconnect
        this.setState('disconnected');
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnect handled there
    };

    this.ws = ws;
  }

  disconnect(): void {
    this.connectGeneration++;
    this.cancelReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setState('disconnected');
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.stateListeners.clear();
    this.messageQueue = [];
    this.activeSubscriptions.clear();
  }

  // ----------------------------------------------------------
  // Send
  // ----------------------------------------------------------

  send(msg: WsClientMessage): void {
    // Track subscriptions for reconnect
    if (msg.type === 'subscribe') this.activeSubscriptions.add(msg.sessionId);
    if (msg.type === 'unsubscribe') this.activeSubscriptions.delete(msg.sessionId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  // ----------------------------------------------------------
  // Event handlers
  // ----------------------------------------------------------

  /** Subscribe to a specific server message type. Returns unsubscribe fn. */
  on<K extends keyof ServerMessageMap>(type: K, handler: MessageHandler<ServerMessageMap[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as AnyMessageHandler);
    return () => set!.delete(handler as AnyMessageHandler);
  }

  /** Subscribe to ALL server messages. Returns unsubscribe fn. */
  onAny(handler: MessageHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }

  /** Subscribe to connection state changes. Returns unsubscribe fn. */
  onStateChange(handler: StateHandler): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  getState(): ConnectionState {
    return this.state;
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const handler of this.stateListeners) {
      handler(state);
    }
  }

  private dispatch(msg: WsServerMessage): void {
    const typeHandlers = this.handlers.get(msg.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) handler(msg);
    }
    for (const handler of this.wildcardHandlers) handler(msg);
  }

  private drainQueue(): void {
    const queue = this.messageQueue;
    this.messageQueue = [];
    for (const msg of queue) {
      this.send(msg);
    }
  }

  private resubscribe(): void {
    for (const sessionId of this.activeSubscriptions) {
      this.send({ type: 'subscribe', sessionId });
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.cancelReconnect();

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
