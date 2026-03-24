/**
 * Workflows Registry
 * Central registry of available workflow specifications
 */

import type { WorkflowSpec } from '../../types';

export const WORKFLOWS_REGISTRY: Record<string, WorkflowSpec> = {
  agentJob: {
    id: 'agentJob',
    name: 'Agent Job',
    description: 'Orchestrates agent behavior for job execution. Controls turn completion based on job state and auto-deactivates when the job terminates.',
  },
};

/**
 * Get all available workflow specifications
 */
export function getAvailableWorkflows(): WorkflowSpec[] {
  return Object.values(WORKFLOWS_REGISTRY);
}

/**
 * Get a specific workflow specification by ID
 */
export function getWorkflowSpec(workflowId: string): WorkflowSpec | undefined {
  return WORKFLOWS_REGISTRY[workflowId];
}
