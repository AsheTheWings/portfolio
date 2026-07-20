import type { AgentimeProblem } from '@agentime/protocol';
import type { SessionEvent } from '../types/session';
import { createAgentStore } from '../stores/useAgentStore';
import { toSessionComponents } from '../utils/toSessionComponent';

const workflowProblem: AgentimeProblem = {
  diagnosticId: '55555555-5555-4555-8555-555555555555',
  code: 'WORKFLOW_EXECUTION_FAILED',
  message: 'The workflow could not complete.',
  retryable: false,
  recoveryActions: ['restart_workflow'],
  context: { workflowId: 'mailbox', workflowVersion: 1 },
};

const toolProblem: AgentimeProblem = {
  diagnosticId: '66666666-6666-4666-8666-666666666666',
  code: 'BUILTIN_TOOL_FAILED',
  message: 'A built-in tool could not complete.',
  retryable: true,
  recoveryActions: ['retry'],
  context: { server: 'system', tool: 'read' },
};

const base = {
  role: 'system' as const,
  timestamp: new Date('2026-07-19T00:00:00.000Z'),
  workflowId: 'mailbox',
  runId: 'run-1',
  interactionId: 'interaction-1',
  agentId: 'agent-1',
  schemaVersion: 2,
};
const toolCall = {
  ...base,
  eventId: 'tool-call',
  type: 'tool-call',
  sequence: 0,
  toolCallEventId: null,
  data: { server: 'system', tool: 'read', arguments: {}, metadata: {} },
} as SessionEvent;
const toolResult = {
  ...base,
  eventId: 'tool-result',
  type: 'tool-result',
  sequence: 1,
  toolCallEventId: 'tool-call',
  data: {
    server: 'system',
    tool: 'read',
    outcome: { status: 'failure', problem: toolProblem },
  },
} as SessionEvent;
const workflowFailure = {
  ...base,
  eventId: 'workflow-failure',
  type: 'workflow_failed',
  sequence: 2,
  interactionId: null,
  agentId: null,
  toolCallEventId: null,
  data: {
    workflowId: 'mailbox',
    runId: 'run-1',
    durationMs: 25,
    problem: workflowProblem,
  },
} as SessionEvent;

describe('Timeline failure projection and state', () => {
  test.each(['chat', 'flat'] as const)(
    'renders durable workflow and tool failures in the %s interface projection',
    (uiInterface) => {
      const components = toSessionComponents(
        [toolCall, toolResult, workflowFailure],
        uiInterface,
      );
      const workflow = components.find((component) => component.type === 'workflow-problem');
      expect(workflow?.data.problem).toEqual(workflowProblem);

      if (uiInterface === 'flat') {
        expect(components.find((component) => component.id === 'tool-call')?.data.problem)
          .toEqual(toolProblem);
      } else {
        const composite = components.find((component) => component.type === 'agent-message');
        expect(composite?.data.items?.find((item) => item.id === 'tool-call')?.data.problem)
          .toEqual(toolProblem);
      }
    },
  );

  test('keeps command scopes independent and reconstructs durable history without notifications', () => {
    const store = createAgentStore();
    store.getState().setCurrentSessionId('session-1');
    store.getState().setCommandProblem('composer', {
      diagnosticId: '77777777-7777-4777-8777-777777777777',
      problem: {
        ...workflowProblem,
        diagnosticId: '77777777-7777-4777-8777-777777777777',
      },
      delivery: 'command',
      observedAt: '2026-07-19T00:00:00.000Z',
      location: {
        kind: 'command',
        commandId: '88888888-8888-4888-8888-888888888888',
        command: 'user_message',
        controlId: 'composer',
      },
    });
    store.getState().setCommandProblem('workflow-abort', {
      diagnosticId: '99999999-9999-4999-8999-999999999999',
      problem: {
        ...workflowProblem,
        diagnosticId: '99999999-9999-4999-8999-999999999999',
      },
      delivery: 'command',
      observedAt: '2026-07-19T00:00:00.000Z',
      location: {
        kind: 'command',
        commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        command: 'abort_workflow',
        sessionId: 'session-1',
        controlId: 'workflow-abort',
      },
    });
    store.getState().setCommandProblem('composer', null);
    expect(store.getState().commandProblemIds).toEqual({
      'workflow-abort': '99999999-9999-4999-8999-999999999999',
    });

    store.getState().hydrateFromEvents([toolCall, toolResult, workflowFailure]);
    expect(store.getState().problemOccurrences[toolProblem.diagnosticId]?.delivery)
      .toBe('replay');
    expect(store.getState().problemOccurrences[workflowProblem.diagnosticId]?.delivery)
      .toBe('replay');
    expect(store.getState().notifiedProblemIds).toEqual({});

    store.getState().markWorkflowUncertain({
      sessionId: 'session-1',
      workflowId: 'mailbox',
      runId: 'run-1',
      problemDiagnosticId: workflowProblem.diagnosticId,
      synchronization: 'required',
    });
    expect(store.getState()).toMatchObject({
      workflowStatus: 'uncertain',
      workflowRunId: 'run-1',
      uncertainWorkflowRuns: {
        'run-1': { synchronization: 'required' },
      },
    });
  });
});
