/**
 * WebSocket Wire Protocol Types
 *
 * Mirrors the backend's WS message types exactly.
 * These are the raw JSON shapes sent over the wire — timestamps are ISO strings,
 * not Date objects. The store / event ingestion layer converts these to rich
 * frontend types (SessionEvent, SessionComponent, etc.).
 */

import type { Agent } from './session';

// ============================================================
// Wire Event (JSON-serialized SessionEvent from backend)
// ============================================================

export type SessionEventType =
  | 'user-input-committed'
  | 'model-message-chunk'
  | 'model-message-completed'
  | 'model-thought-chunk'
  | 'model-thought-completed'
  | 'tool-call'
  | 'tool-result'
  | 'tool-effects'
  | 'user-feedback-result'
  | 'agent-turn-completed'
  | 'session_branched'
  // Workflow run lifecycle (system events stamped on every run)
  | 'workflow_started'
  | 'workflow_resumed'
  | 'workflow_paused'
  | 'workflow_completed'
  | 'workflow_aborted'
  | 'workflow_failed';

/** Raw event shape as received over the wire (timestamp is ISO string) */
export interface WireSessionEvent {
  eventId: string;
  workflowId: string | null;       // Run-scoped events stamp the active workflow id
  runId: string | null;            // Run-scoped events stamp the active run id
  interactionId: string;
  type: SessionEventType;
  role: 'user' | 'agent' | 'system';
  agentId?: string;
  toolCallEventId?: string;
  breakpointEventId?: string;      // session_branched events only
  sequence: number;
  timestamp: string;               // ISO 8601 — converted to Date on ingestion
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
    workflow?: string;  // Session workflow id — only read on new session creation
    libraryItemIds?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface WsAbortWorkflowMessage {
  type: 'abort_workflow';
  sessionId: string;
}

export interface WsSubmitFeedbackMessage {
  type: 'submit_feedback';
  sessionId: string;
  toolCallEventId: string;
  feedbackData: unknown;
}

export interface WsDelegatedToolResultMessage {
  type: 'delegated_tool_result';
  sessionId: string;
  requestId: string;
  result: unknown;
}

export interface WsDelegatedToolErrorMessage {
  type: 'delegated_tool_error';
  sessionId: string;
  requestId: string;
  error: string;
}

export interface WsResumeWorkflowMessage {
  type: 'resume_workflow';
  sessionId: string;
}

export interface WsRevertToSessionEventMessage {
  type: 'revert_to_session_event';
  sessionId: string;
  breakpointEventId: string;
}

export interface WsEditSessionEventMessage {
  type: 'edit_session_event';
  sessionId: string;
  breakpointEventId: string;
  updatedData: Record<string, unknown>;
  configOverride?: Record<string, unknown>;
}

export type WsClientMessage =
  | WsSubscribeMessage
  | WsUnsubscribeMessage
  | WsUserMessageMessage
  | WsAbortWorkflowMessage
  | WsSubmitFeedbackMessage
  | WsDelegatedToolResultMessage
  | WsDelegatedToolErrorMessage
  | WsResumeWorkflowMessage
  | WsRevertToSessionEventMessage
  | WsEditSessionEventMessage;

// ============================================================
// Server → Client Messages
// ============================================================

export interface WsSessionEventMessage {
  type: 'session_event';
  sessionId: string;
  event: WireSessionEvent;
}

export interface WsSessionCreatedMessage {
  type: 'session_created';
  sessionId: string;
}

export type WsAgentErrorCode =
  | 'MISSING_API_KEY'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_PROVIDER_AUTH_FAILED'
  | 'MODEL_PROVIDER_RATE_LIMITED'
  | 'MODEL_PROVIDER_FAILED'
  | 'AGENT_RUNTIME_ERROR';

export interface WsAgentErrorPayload {
  code: WsAgentErrorCode;
  message: string;
  providerId?: string;
  modelId?: string;
  agentId?: string;
  status?: number;
  retryable: boolean;
}

/** Immediate ack on run start — carries the runId so the FE can bind
 *  delegated tool requests / track the active run. */
export interface WsWorkflowStartedAckMessage {
  type: 'workflow_started_ack';
  sessionId: string;
  runId: string;
  workflowId: string;
}

export interface WsExecuteDelegatedToolMessage {
  type: 'execute_delegated_tool';
  sessionId: string;
  requestId: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface WsCancelDelegatedToolMessage {
  type: 'cancel_delegated_tool';
  sessionId: string;
  runId: string;
  requestId: string;
  reason: string;
}

export interface WsErrorMessage {
  type: 'error';
  sessionId?: string;
  error: string;
}

export interface WsSessionBranchedMessage {
  type: 'session_branched';
  oldSessionId: string;
  newSessionId: string;
}

export type WsServerMessage =
  | WsSessionEventMessage
  | WsSessionCreatedMessage
  | WsWorkflowStartedAckMessage
  | WsExecuteDelegatedToolMessage
  | WsCancelDelegatedToolMessage
  | WsErrorMessage
  | WsSessionBranchedMessage;
