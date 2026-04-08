/**
 * WebSocket Wire Protocol Types
 *
 * Mirrors the backend's WS message types exactly.
 * These are the raw JSON shapes sent over the wire — timestamps are ISO strings,
 * not Date objects. The store / event ingestion layer converts these to rich
 * frontend types (AgentSessionEvent, AgentSessionComponent, etc.).
 */

import type { Agent, AgentMetadata } from './index';

// ============================================================
// Wire Event (JSON-serialized AgentSessionEvent from backend)
// ============================================================

export type AgentSessionEventType =
  | 'user-turn-completed'
  | 'model-message-chunk'
  | 'model-message-completed'
  | 'model-thought-chunk'
  | 'model-thought-completed'
  | 'tool-call'
  | 'tool-result'
  | 'tool-effects'
  | 'user-feedback-result'
  | 'agent-turn-completed'
  | 'branch';

/** Raw event shape as received over the wire (timestamp is ISO string) */
export interface WireAgentSessionEvent {
  eventId: string;
  componentId: string;
  turnId: string;
  type: AgentSessionEventType;
  role: 'user' | 'agent' | 'system';
  sequence: number;
  timestamp: string; // ISO 8601 — converted to Date on ingestion
  data: Record<string, unknown>;
}

// ============================================================
// Client → Server Messages
// ============================================================

export interface WsSubscribeMessage {
  type: 'subscribe';
  sessionId: string;
  lastSequence?: number;
}

export interface WsUnsubscribeMessage {
  type: 'unsubscribe';
  sessionId: string;
}

export interface WsUserMessageMessage {
  type: 'user_message';
  sessionId?: string;
  data: {
    message: string;
    agents: Agent[];             // Ordered agent configs, [0] = active
    libraryItemIds?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface WsStopAgentMessage {
  type: 'stop_agent';
  sessionId: string;
}

export interface WsSubmitFeedbackMessage {
  type: 'submit_feedback';
  sessionId: string;
  componentId: string;
  feedbackData: unknown;
}

export interface WsCustomToolResultMessage {
  type: 'custom_tool_result';
  sessionId: string;
  requestId: string;
  result: unknown;
}

export interface WsResumeAgentMessage {
  type: 'resume_agent';
  sessionId: string;
}

export interface WsRevertToComponentMessage {
  type: 'revert_to_component';
  sessionId: string;
  componentId: string;
}

export interface WsEditComponentMessage {
  type: 'edit_component';
  sessionId: string;
  componentId: string;
  updatedData: Record<string, unknown>;
  configOverride?: Record<string, unknown>;
}

export type WsClientMessage =
  | WsSubscribeMessage
  | WsUnsubscribeMessage
  | WsUserMessageMessage
  | WsStopAgentMessage
  | WsSubmitFeedbackMessage
  | WsCustomToolResultMessage
  | WsResumeAgentMessage
  | WsRevertToComponentMessage
  | WsEditComponentMessage;

// ============================================================
// Server → Client Messages
// ============================================================

export interface WsAgentSessionEventMessage {
  type: 'session_event';
  sessionId: string;
  event: WireAgentSessionEvent;
}

export interface WsAgentSessionCreatedMessage {
  type: 'session_created';
  sessionId: string;
}

export interface WsAgentStatusMessage {
  type: 'agent_status';
  sessionId: string;
  status: 'completed' | 'aborted' | 'paused' | 'error' | 'resuming';
  error?: string;
  deletedComponentIds?: string[];
}

export interface WsExecuteCustomToolMessage {
  type: 'execute_custom_tool';
  sessionId: string;
  requestId: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface WsErrorMessage {
  type: 'error';
  error: string;
}

export interface WsSessionBranchedMessage {
  type: 'session_branched';
  oldSessionId: string;
  newSessionId: string;
}

export type WsServerMessage =
  | WsAgentSessionEventMessage
  | WsAgentSessionCreatedMessage
  | WsAgentStatusMessage
  | WsExecuteCustomToolMessage
  | WsErrorMessage
  | WsSessionBranchedMessage;
