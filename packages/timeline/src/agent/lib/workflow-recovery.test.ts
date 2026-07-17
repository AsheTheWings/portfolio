import { workflowRecoveryCommand } from './workflow-recovery';

describe('workflow recovery', () => {
  it('offers a canonical reset only for an actionable incompatible workflow', () => {
    expect(workflowRecoveryCommand({
      type: 'error',
      code: 'WORKFLOW_VERSION_UNSUPPORTED',
      error: 'The paused workflow version is unsupported',
      sessionId: 'session-1',
      recoveryActions: ['abandon_workflow', 'revert_to_session_event'],
    })).toEqual({ type: 'abandon_workflow', sessionId: 'session-1' });

    expect(workflowRecoveryCommand({
      type: 'error',
      code: 'VALIDATION_FAILED',
      error: 'Invalid message',
    })).toBeNull();
  });

  test('targets the conflicting paused run when the server supplies its identity', () => {
    expect(workflowRecoveryCommand({
      type: 'error',
      code: 'WORKFLOW_RECOVERY_REQUIRED',
      error: 'Recover the previous run',
      sessionId: 'session-1',
      details: { runId: 'run-1' },
      recoveryActions: ['abandon_workflow'],
    })).toEqual({ type: 'abandon_workflow', sessionId: 'session-1', runId: 'run-1' });
  });
});
