import type { SessionEvent } from '../types/session';
import type {
  ProblemDelivery,
  ProblemOccurrence,
} from './types';

export function durableProblemOccurrence(
  event: SessionEvent,
  sessionId: string,
  delivery: Extract<ProblemDelivery, 'live' | 'replay' | 'catch_up'>,
): ProblemOccurrence | null {
  if (event.type === 'workflow_failed') {
    const problem = event.data.problem;
    return {
      diagnosticId: problem.diagnosticId,
      problem,
      delivery,
      observedAt: event.timestamp.toISOString(),
      location: {
        kind: 'workflow',
        sessionId,
        runId: event.data.runId,
        eventId: event.eventId,
      },
    };
  }

  if (event.type === 'tool-result' && event.data.outcome.status === 'failure') {
    const problem = event.data.outcome.problem;
    return {
      diagnosticId: problem.diagnosticId,
      problem,
      delivery,
      observedAt: event.timestamp.toISOString(),
      location: {
        kind: 'tool',
        sessionId,
        runId: event.runId ?? undefined,
        toolCallEventId: event.toolCallEventId ?? event.eventId,
        eventId: event.eventId,
      },
    };
  }

  return null;
}

export function indexDurableProblems(
  events: SessionEvent[],
  sessionId: string,
  delivery: Extract<ProblemDelivery, 'replay' | 'catch_up'> = 'replay',
): Pick<{
  problemOccurrences: Record<string, ProblemOccurrence>;
  problemOccurrenceOrder: string[];
}, 'problemOccurrences' | 'problemOccurrenceOrder'> {
  const problemOccurrences: Record<string, ProblemOccurrence> = {};
  const problemOccurrenceOrder: string[] = [];

  for (const event of events) {
    const occurrence = durableProblemOccurrence(event, sessionId, delivery);
    if (!occurrence) continue;
    if (!problemOccurrences[occurrence.diagnosticId]) {
      problemOccurrenceOrder.push(occurrence.diagnosticId);
    }
    problemOccurrences[occurrence.diagnosticId] = occurrence;
  }

  return { problemOccurrences, problemOccurrenceOrder };
}

export function shouldToastProblem(
  occurrence: ProblemOccurrence,
  alreadyNotified: Readonly<Record<string, true>>,
): boolean {
  return occurrence.delivery === 'live' && !alreadyNotified[occurrence.diagnosticId];
}
