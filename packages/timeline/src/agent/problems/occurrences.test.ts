import type { AgentimeProblem } from '@agentime/protocol';
import type { SessionEvent } from '../types/session';
import {
  durableProblemOccurrence,
  indexDurableProblems,
  shouldToastProblem,
} from './occurrences';

const workflowProblem: AgentimeProblem = {
  diagnosticId: '33333333-3333-4333-8333-333333333333',
  code: 'WORKFLOW_EXECUTION_FAILED',
  message: 'The workflow could not complete.',
  retryable: false,
  recoveryActions: ['restart_workflow'],
  context: { workflowId: 'mailbox', workflowVersion: 1 },
};

const toolProblem: AgentimeProblem = {
  diagnosticId: '44444444-4444-4444-8444-444444444444',
  code: 'MCP_TOOL_FAILED',
  message: 'An MCP tool could not complete.',
  retryable: true,
  recoveryActions: ['retry', 'inspect_mcp_configuration'],
  context: { server: 'local', tool: 'search' },
};

const workflowFailure = {
  eventId: 'workflow-event',
  type: 'workflow_failed',
  role: 'system',
  sequence: 3,
  timestamp: new Date('2026-07-19T00:00:00.000Z'),
  workflowId: 'mailbox',
  runId: 'run-1',
  interactionId: null,
  agentId: null,
  toolCallEventId: null,
  schemaVersion: 2,
  data: {
    workflowId: 'mailbox',
    runId: 'run-1',
    durationMs: 10,
    problem: workflowProblem,
  },
} as SessionEvent;

const toolFailure = {
  eventId: 'tool-result-event',
  type: 'tool-result',
  role: 'system',
  sequence: 2,
  timestamp: new Date('2026-07-19T00:00:00.000Z'),
  workflowId: 'mailbox',
  runId: 'run-1',
  interactionId: 'interaction-1',
  agentId: 'agent-1',
  toolCallEventId: 'tool-call-event',
  schemaVersion: 2,
  data: {
    server: 'local',
    tool: 'search',
    outcome: { status: 'failure', problem: toolProblem },
  },
} as SessionEvent;

describe('durable problem occurrences', () => {
  test('projects workflow and tool scope without reducing the canonical problem', () => {
    expect(durableProblemOccurrence(workflowFailure, 'session-1', 'live'))
      .toMatchObject({
        diagnosticId: workflowProblem.diagnosticId,
        problem: workflowProblem,
        delivery: 'live',
        location: {
          kind: 'workflow',
          sessionId: 'session-1',
          runId: 'run-1',
          eventId: 'workflow-event',
        },
      });
    expect(durableProblemOccurrence(toolFailure, 'session-1', 'catch_up'))
      .toMatchObject({
        diagnosticId: toolProblem.diagnosticId,
        problem: toolProblem,
        delivery: 'catch_up',
        location: {
          kind: 'tool',
          toolCallEventId: 'tool-call-event',
          eventId: 'tool-result-event',
        },
      });
  });

  test('reconstructs history without creating a live notification', () => {
    const indexed = indexDurableProblems(
      [toolFailure, workflowFailure, workflowFailure],
      'session-1',
    );
    expect(indexed.problemOccurrenceOrder).toEqual([
      toolProblem.diagnosticId,
      workflowProblem.diagnosticId,
    ]);
    expect(Object.values(indexed.problemOccurrences).every(
      (occurrence) => occurrence.delivery === 'replay',
    )).toBe(true);
    expect(shouldToastProblem(indexed.problemOccurrences[workflowProblem.diagnosticId]!, {}))
      .toBe(false);

    const live = durableProblemOccurrence(workflowFailure, 'session-1', 'live')!;
    expect(shouldToastProblem(live, {})).toBe(true);
    expect(shouldToastProblem(live, { [workflowProblem.diagnosticId]: true })).toBe(false);
  });
});
