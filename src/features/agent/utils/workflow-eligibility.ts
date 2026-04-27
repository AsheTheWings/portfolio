/**
 * Workflow eligibility — single source of truth for "can this workflow run
 * with the currently configured agents?"
 *
 * Constraints live on the workflow registry definition itself
 * (`Workflow.minAcquiredAgents`). This module just consults that field —
 * no per-workflow branching, no magic numbers.
 *
 * Mirrors the backend dispatcher (`agent/session.resolveEffectiveWorkflow`):
 *   - `'none'` is never counted as an acquired agent.
 *   - A workflow with `minAcquiredAgents: N` requires \u2265 N non-'none' agents.
 *   - Workflows without the field have no requirement.
 */

import type { Agent, Workflow } from '../types';

/**
 * Count agents that count toward `minAcquiredAgents` \u2014 i.e. exclude `'none'`.
 */
export function countAcquired(agents: Pick<Agent, 'agentId'>[]): number {
  return agents.filter(a => a.agentId !== 'none').length;
}

/**
 * Is this workflow eligible given the current agents array?
 */
export function isWorkflowEligible(
  workflow: Workflow,
  agents: Pick<Agent, 'agentId'>[],
): boolean {
  const min = workflow.minAcquiredAgents ?? 0;
  return countAcquired(agents) >= min;
}

/**
 * Human-readable reason a workflow is locked, or null if it's eligible.
 */
export function workflowLockReason(
  workflow: Workflow,
  agents: Pick<Agent, 'agentId'>[],
): string | null {
  const min = workflow.minAcquiredAgents ?? 0;
  if (min === 0) return null;
  const acquired = countAcquired(agents);
  if (acquired >= min) return null;
  return `Requires ${min} agents (${acquired}/${min} selected)`;
}
