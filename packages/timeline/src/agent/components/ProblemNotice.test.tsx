import { fireEvent, render, screen } from '@testing-library/react';
import type { AgentimeProblem } from '@agentime/protocol';
import { ProblemNotice } from './ProblemNotice';

const problem: AgentimeProblem = {
  diagnosticId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  code: 'MCP_TOOL_FAILED',
  message: 'An MCP tool could not complete.',
  retryable: true,
  recoveryActions: ['retry', 'inspect_mcp_configuration'],
  context: { server: 'local', tool: 'search' },
};

describe('ProblemNotice accessibility', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  test('exposes the message, diagnostic reference, copy control, and supported recovery actions', async () => {
    const onRecoveryAction = jest.fn();
    render(
      <ProblemNotice
        problem={problem}
        location={{
          kind: 'tool',
          sessionId: 'session-1',
          runId: 'run-1',
          toolCallEventId: 'tool-call',
          eventId: 'tool-result',
        }}
        onRecoveryAction={onRecoveryAction}
        availableRecoveryActions={['inspect_mcp_configuration']}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAccessibleName('MCP tool failed');
    expect(alert).toHaveAccessibleDescription(problem.message);
    expect(screen.getByText(`Reference: ${problem.diagnosticId}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    const inspect = screen.getByRole('button', { name: 'Inspect MCP configuration' });
    inspect.focus();
    fireEvent.keyDown(inspect, { key: 'Enter' });
    fireEvent.click(inspect);
    expect(onRecoveryAction).toHaveBeenCalledWith('inspect_mcp_configuration');

    fireEvent.click(screen.getByRole('button', {
      name: `Copy diagnostic reference ${problem.diagnosticId}`,
    }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(problem.diagnosticId);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
});
