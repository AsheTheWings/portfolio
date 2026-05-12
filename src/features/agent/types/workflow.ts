/**
 * Agent workflow registry types.
 */

// Workflow specification — mirrors the backend registry shape exactly
export interface Workflow {
  id: string;
  description: string;
  mermaid: string;
  isDefault?: boolean;
  /**
   * Minimum acquired agents (non-`'none'`) required to run this workflow.
   * Defaults to 0. The single source of truth for eligibility on both
   * sides — see `agent/utils/workflow-eligibility.ts`.
   */
  minAcquiredAgents?: number;
}

/** Derives a human-readable display name from a snake_case workflow id. */
export function workflowDisplayName(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
