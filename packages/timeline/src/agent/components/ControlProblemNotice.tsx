'use client';

import { useAgentStore } from '../stores/useAgentStore';
import { ProblemNotice } from './ProblemNotice';

export function ControlProblemNotice({
  controlId,
  className,
}: {
  controlId: string;
  className?: string;
}) {
  const diagnosticId = useAgentStore((state) => state.commandProblemIds[controlId]);
  const occurrence = useAgentStore((state) => (
    diagnosticId ? state.problemOccurrences[diagnosticId] : undefined
  ));
  if (!occurrence || occurrence.location.kind !== 'command') return null;
  return (
    <ProblemNotice
      problem={occurrence.problem}
      location={occurrence.location}
      className={className}
    />
  );
}
