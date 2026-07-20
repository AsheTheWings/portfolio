export * from "@agentime/protocol";

import type {
  ClientMessage,
  ServerMessage,
  SessionEventMessage,
  SessionBranchedMessage,
  CommandFailedMessage,
  ConnectionFailedMessage,
  WireSessionEvent as CanonicalWireSessionEvent,
} from "@agentime/protocol";

export type WsClientMessage = ClientMessage;
export type WsServerMessage = ServerMessage;
export type WsSessionEventMessage = SessionEventMessage;
export type WsSessionBranchedMessage = SessionBranchedMessage;
export type WsCommandFailedMessage = CommandFailedMessage;
export type WsConnectionFailedMessage = ConnectionFailedMessage;
export type WireSessionEvent = CanonicalWireSessionEvent;
