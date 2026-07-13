export * from "@agentime/protocol";

import type {
  ClientMessage,
  ServerMessage,
  SessionEventMessage,
  SessionCreatedMessage,
  SessionBranchedMessage,
  ErrorMessage,
  WireSessionEvent as CanonicalWireSessionEvent,
} from "@agentime/protocol";

export type WsClientMessage = ClientMessage;
export type WsServerMessage = ServerMessage;
export type WsSessionEventMessage = SessionEventMessage;
export type WsSessionCreatedMessage = SessionCreatedMessage;
export type WsSessionBranchedMessage = SessionBranchedMessage;
export type WsErrorMessage = ErrorMessage;
export type WireSessionEvent = CanonicalWireSessionEvent;
export type WsAgentErrorPayload = any;
