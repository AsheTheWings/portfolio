'use client';

import type { AgentimeRecoveryAction } from '@agentime/protocol';
import { useAgentConnection } from '../hooks/useAgentConnection';
import { runScopedCommand } from '../problems/commands';
import { useAgentStore } from '../stores/useAgentStore';
import { ProblemNotice } from './ProblemNotice';

export function WorkflowUncertainStatus() {
  const { command } = useAgentConnection();
  const workflowStatus = useAgentStore((state) => state.workflowStatus);
  const run = useAgentStore((state) => (
    state.workflowRunId ? state.uncertainWorkflowRuns[state.workflowRunId] : undefined
  ));
  const occurrence = useAgentStore((state) => (
    run ? state.problemOccurrences[run.problemDiagnosticId] : undefined
  ));

  if (
    workflowStatus !== 'uncertain'
    || !run
    || !occurrence
    || occurrence.location.kind !== 'workflow'
  ) {
    return null;
  }

  const available = occurrence.problem.recoveryActions.filter((action) => (
    (action === 'synchronize_session' && run.synchronization !== 'synchronizing')
    || (action === 'abandon_workflow' && run.synchronization === 'synchronized')
  ));

  const recover = (action: AgentimeRecoveryAction) => {
    if (action === 'synchronize_session') {
      useAgentStore.getState().setWorkflowSynchronization(run.runId, 'synchronizing');
      void runScopedCommand(
        command,
        {
          type: 'sync_session',
          sessionId: run.sessionId,
          lastSequence: useAgentStore.getState().sessionEvents.at(-1)?.sequence ?? -1,
        },
        `workflow-sync:${run.runId}`,
      ).then(() => {
        useAgentStore.getState().setWorkflowSynchronization(run.runId, 'synchronized');
      }).catch(() => {
        useAgentStore.getState().setWorkflowSynchronization(run.runId, 'required');
      });
      return;
    }
    if (action === 'abandon_workflow') {
      void runScopedCommand(
        command,
        { type: 'abandon_workflow', sessionId: run.sessionId, runId: run.runId },
        `workflow-abandon:${run.runId}`,
      ).catch(() => undefined);
    }
  };

  return (
    <div className="absolute inset-x-0 top-28 z-30 mx-auto w-[min(44rem,calc(100%-2rem))]">
      <ProblemNotice
        problem={occurrence.problem}
        location={occurrence.location}
        onRecoveryAction={recover}
        availableRecoveryActions={available}
      />
      <p className="mt-1 text-xs text-muted-foreground" role="status">
        Synchronization: {run.synchronization}
      </p>
    </div>
  );
}
