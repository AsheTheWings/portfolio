import type {
  AgentimeProblem,
  AgentimeProblemCode,
  AgentimeRecoveryAction,
} from '@agentime/protocol';
import type {
  ProblemLocation,
  ProblemPresentation,
} from './types';

const WORDING_BY_CODE: Readonly<Partial<Record<AgentimeProblemCode, Readonly<{
  title: string;
  message?: string;
}>>>> = {
  CREDENTIAL_NOT_CONFIGURED: {
    title: 'Credentials required',
    message: 'Configure credentials for the selected provider, then try again.',
  },
  MODEL_UNAVAILABLE: {
    title: 'Model unavailable',
    message: 'Choose an available model before trying again.',
  },
  MODEL_AUTHENTICATION_FAILED: {
    title: 'Provider authentication failed',
    message: 'Check the provider credentials, then try again.',
  },
  MODEL_RATE_LIMITED: {
    title: 'Model request rate-limited',
    message: 'Wait briefly before trying this request again.',
  },
  MODEL_REQUEST_FAILED: {
    title: 'Model request failed',
  },
  WORKFLOW_VERSION_UNSUPPORTED: {
    title: 'Workflow version unsupported',
    message: 'This run cannot continue with the installed workflow version.',
  },
  WORKFLOW_RECOVERY_REQUIRED: {
    title: 'Workflow state needs recovery',
    message: 'Synchronize this session before choosing a supported recovery action.',
  },
  MCP_TOOL_FAILED: {
    title: 'MCP tool failed',
  },
  INTERNAL_ERROR: {
    title: 'Unexpected Agentime failure',
  },
};

const LOCATION_TITLES: Readonly<Record<ProblemLocation['kind'], string>> = {
  workflow: 'Workflow failed',
  tool: 'Tool failed',
  command: 'Action failed',
  feature: 'Request failed',
  connection: 'Connection failed',
  mcp: 'Local MCP failed',
};

const ACTION_LABELS: Readonly<Record<AgentimeRecoveryAction, string>> = {
  retry: 'Try again',
  configure_credentials: 'Configure credentials',
  restart_workflow: 'Restart workflow',
  abandon_workflow: 'Abandon workflow',
  revert_to_session_event: 'Revert session',
  synchronize_session: 'Synchronize session',
  reconnect: 'Reconnect',
  inspect_mcp_configuration: 'Inspect MCP configuration',
};

/**
 * Application-owned presentation policy. It is intentionally pure: callers
 * retain the canonical problem unchanged and decide where/how to render the
 * returned wording and capabilities.
 */
export function resolveProblemPresentation(
  problem: AgentimeProblem,
  location: ProblemLocation,
): ProblemPresentation {
  const override = WORDING_BY_CODE[problem.code];

  return {
    title: override?.title ?? LOCATION_TITLES[location.kind],
    message: override?.message ?? problem.message,
    diagnosticReference: problem.diagnosticId,
    tone: problem.code === 'WORKFLOW_RECOVERY_REQUIRED' ? 'warning' : 'error',
    actions: problem.recoveryActions.map((capability) => ({
      capability,
      label: ACTION_LABELS[capability],
    })),
  };
}
