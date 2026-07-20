import type { AgentimeProblem } from '@agentime/protocol';
import { resolveProblemPresentation } from './presentation';

const problem: AgentimeProblem = {
  diagnosticId: '11111111-1111-4111-8111-111111111111',
  code: 'STORAGE_CONFLICT',
  message: 'The stored resource conflicts with this operation.',
  retryable: true,
  recoveryActions: ['retry'],
  context: { operation: 'asset.copy' },
};

describe('problem presentation policy', () => {
  test('uses the safe Agentime fallback and diagnostic reference without mutating the problem', () => {
    const before = structuredClone(problem);
    const presentation = resolveProblemPresentation(problem, {
      kind: 'feature',
      feature: 'library',
      controlId: 'asset-copy',
    });

    expect(presentation).toEqual({
      title: 'Request failed',
      message: problem.message,
      diagnosticReference: problem.diagnosticId,
      tone: 'error',
      actions: [{ capability: 'retry', label: 'Try again' }],
    });
    expect(problem).toEqual(before);
  });

  test('applies application wording only for the matching canonical code', () => {
    const credential: AgentimeProblem = {
      diagnosticId: '22222222-2222-4222-8222-222222222222',
      code: 'CREDENTIAL_NOT_CONFIGURED',
      message: 'The required provider credential is not configured.',
      retryable: false,
      recoveryActions: ['configure_credentials'],
      context: { providerId: 'openrouter' },
    };
    expect(resolveProblemPresentation(credential, {
      kind: 'feature',
      feature: 'credential',
      controlId: 'credential:openrouter',
    })).toMatchObject({
      title: 'Credentials required',
      message: 'Configure credentials for the selected provider, then try again.',
      actions: [{
        capability: 'configure_credentials',
        label: 'Configure credentials',
      }],
    });
  });
});
