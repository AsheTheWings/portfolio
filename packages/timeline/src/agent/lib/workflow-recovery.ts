import type { AgentCommandInput } from '@agentime/client';
import type { AgentimeProblem } from '@agentime/protocol';

type AbandonWorkflowCommand = Extract<AgentCommandInput, { type: 'abandon_workflow' }>;

export function workflowRecoveryCommand(
  problem: AgentimeProblem,
  sessionId: string,
  runId?: string,
): AbandonWorkflowCommand | null {
  if (
    (problem.code !== 'WORKFLOW_VERSION_UNSUPPORTED' && problem.code !== 'WORKFLOW_RECOVERY_REQUIRED')
    || !problem.recoveryActions.includes('abandon_workflow')
  ) {
    return null;
  }
  return {
    type: 'abandon_workflow',
    sessionId,
    ...(runId ? { runId } : {}),
  };
}
