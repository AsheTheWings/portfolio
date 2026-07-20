import { workflowRecoveryCommand } from './workflow-recovery';

describe('workflow recovery', () => {
  it('offers a canonical reset only for an actionable incompatible workflow', () => {
    expect(workflowRecoveryCommand({
      diagnosticId: '11111111-1111-4111-8111-111111111111',
      code: 'WORKFLOW_VERSION_UNSUPPORTED',
      message: 'This workflow version can no longer be resumed.',
      retryable: false,
      recoveryActions: ['abandon_workflow', 'revert_to_session_event'],
    }, 'session-1')).toEqual({ type: 'abandon_workflow', sessionId: 'session-1' });

    expect(workflowRecoveryCommand({
      diagnosticId: '22222222-2222-4222-8222-222222222222',
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      retryable: false,
      recoveryActions: [],
    }, 'session-1')).toBeNull();
  });

  test('targets the conflicting paused run when the server supplies its identity', () => {
    expect(workflowRecoveryCommand({
      diagnosticId: '33333333-3333-4333-8333-333333333333',
      code: 'WORKFLOW_RECOVERY_REQUIRED',
      message: 'The workflow state must be synchronized before continuing.',
      retryable: false,
      recoveryActions: ['abandon_workflow'],
    }, 'session-1', 'run-1')).toEqual({
      type: 'abandon_workflow',
      sessionId: 'session-1',
      runId: 'run-1',
    });
  });
});
