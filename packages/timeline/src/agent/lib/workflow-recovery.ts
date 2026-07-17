import type { ClientMessage, ErrorMessage } from '@agentime/protocol';

type AbandonWorkflowMessage = Extract<ClientMessage, { type: 'abandon_workflow' }>;

export function workflowRecoveryCommand(message: ErrorMessage): AbandonWorkflowMessage | null {
  if (
    (message.code !== 'WORKFLOW_VERSION_UNSUPPORTED' && message.code !== 'WORKFLOW_RECOVERY_REQUIRED')
    || !message.sessionId
    || !message.recoveryActions?.includes('abandon_workflow')
  ) {
    return null;
  }
  return {
    type: 'abandon_workflow',
    sessionId: message.sessionId,
    ...(typeof message.details?.runId === 'string' ? { runId: message.details.runId } : {}),
  };
}
