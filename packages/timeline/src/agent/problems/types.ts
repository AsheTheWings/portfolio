import type {
  AgentimeProblem,
  ApplicationCommandType,
  AgentimeRecoveryAction,
} from '@agentime/protocol';

export type ProblemLocation =
  | { kind: 'workflow'; sessionId: string; runId: string; eventId?: string }
  | { kind: 'tool'; sessionId: string; runId?: string; toolCallEventId: string; eventId: string }
  | {
      kind: 'command';
      commandId: string;
      command: ApplicationCommandType;
      sessionId?: string;
      controlId: string;
    }
  | { kind: 'feature'; feature: AgentimeFeature; controlId: string }
  | { kind: 'connection'; phase: 'ticket' | 'authentication' | 'protocol' | 'transport' | 'reconnect' }
  | {
      kind: 'mcp';
      operation: 'registration' | 'health' | 'configuration' | 'catalog' | 'execution';
      server?: string;
    };

export type AgentimeFeature =
  | 'agent'
  | 'credential'
  | 'model'
  | 'library'
  | 'media'
  | 'text'
  | 'session';

export type ProblemDelivery = 'live' | 'replay' | 'catch_up' | 'command' | 'http' | 'connection';

export interface ProblemOccurrence {
  diagnosticId: string;
  problem: AgentimeProblem;
  location: ProblemLocation;
  delivery: ProblemDelivery;
  observedAt: string;
}

export interface UncertainWorkflowRun {
  sessionId: string;
  workflowId: string;
  runId: string;
  problemDiagnosticId: string;
  synchronization: 'required' | 'synchronizing' | 'synchronized';
}

export interface ClientConnectionDiagnostic {
  code: string;
  message: string;
  observedAt: string;
}

export interface ConnectionProblemState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  problemDiagnosticId: string | null;
  diagnostic: ClientConnectionDiagnostic | null;
}

export interface LocalMcpProblem {
  id: string;
  code:
    | 'MCP_CONFIGURATION_INVALID'
    | 'MCP_PAIRING_REQUIRED'
    | 'MCP_HOST_UNAVAILABLE'
    | 'MCP_HEALTH_FAILED'
    | 'MCP_CATALOG_REJECTED'
    | 'MCP_TIMEOUT'
    | 'MCP_EXECUTION_FAILED'
    | 'MCP_UNEXPECTED_FAILURE';
  message: string;
  operation: Extract<ProblemLocation, { kind: 'mcp' }>['operation'];
  server?: string;
  retryable: boolean;
  recoveryActions: Extract<AgentimeRecoveryAction, 'retry' | 'inspect_mcp_configuration'>[];
  observedAt: string;
}

export interface ProblemPresentation {
  title: string;
  message: string;
  diagnosticReference: string;
  tone: 'error' | 'warning';
  actions: Array<{
    capability: AgentimeRecoveryAction;
    label: string;
  }>;
}
