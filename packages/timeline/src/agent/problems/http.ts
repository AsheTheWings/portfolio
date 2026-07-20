import { AgentimeHttpError } from '@agentime/client';
import type { AgentimeFeature } from './types';
import { useAgentStore } from '../stores/useAgentStore';

export function recordHttpProblem(
  error: unknown,
  feature: AgentimeFeature,
  controlId: string,
): string | null {
  if (!(error instanceof AgentimeHttpError)) return null;
  useAgentStore.getState().recordProblem({
    diagnosticId: error.problem.diagnosticId,
    problem: error.problem,
    delivery: 'http',
    observedAt: new Date().toISOString(),
    location: { kind: 'feature', feature, controlId },
  });
  return error.problem.diagnosticId;
}

export async function withHttpProblem<T>(
  operation: () => Promise<T>,
  feature: AgentimeFeature,
  controlId: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    recordHttpProblem(error, feature, controlId);
    throw error;
  }
}
