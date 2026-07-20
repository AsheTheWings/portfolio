import { act, render, screen } from '@testing-library/react';
import { useAgentStore } from '../stores/useAgentStore';
import { ConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  test('keeps a client transport diagnostic visible as persistent status', () => {
    useAgentStore.getState().setConnectionProblem({
      status: 'error',
      problemDiagnosticId: null,
      diagnostic: {
        code: 'WEBSOCKET_FAILED',
        message: 'The Agentime WebSocket reported a transport error',
        observedAt: '2026-07-19T00:00:00.000Z',
      },
    });
    render(<ConnectionStatus />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The Agentime WebSocket reported a transport error',
    );
    expect(screen.getByText('WEBSOCKET_FAILED')).toBeInTheDocument();
  });

  test('shows the canonical connection problem and clears the surface when connected', () => {
    const diagnosticId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    useAgentStore.getState().recordProblem({
      diagnosticId,
      problem: {
        diagnosticId,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
        retryable: false,
        recoveryActions: [],
      },
      delivery: 'connection',
      observedAt: '2026-07-19T00:00:00.000Z',
      location: { kind: 'connection', phase: 'authentication' },
    });
    useAgentStore.getState().setConnectionProblem({
      status: 'error',
      problemDiagnosticId: diagnosticId,
      diagnostic: null,
    });
    const rendered = render(<ConnectionStatus />);
    expect(screen.getByRole('alert')).toHaveTextContent('Authentication is required.');

    act(() => {
      useAgentStore.getState().setConnectionProblem({
        status: 'connected',
        problemDiagnosticId: null,
        diagnostic: null,
      });
    });
    rendered.rerender(<ConnectionStatus />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
