'use client';

import type { AgentimeFeature } from '../problems/types';
import { useAgentStore } from '../stores/useAgentStore';
import { ProblemNotice } from './ProblemNotice';

export function FeatureProblemNotice({
  feature,
  controlId,
  className,
}: {
  feature: AgentimeFeature;
  controlId?: string;
  className?: string;
}) {
  const occurrence = useAgentStore((state) => (
    [...state.problemOccurrenceOrder].reverse()
      .map((id) => state.problemOccurrences[id])
      .find((candidate) => (
        candidate?.location.kind === 'feature'
        && candidate.location.feature === feature
        && (controlId === undefined || candidate.location.controlId === controlId)
      ))
  ));
  if (!occurrence || occurrence.location.kind !== 'feature') return null;
  return (
    <ProblemNotice
      problem={occurrence.problem}
      location={occurrence.location}
      className={className}
    />
  );
}
