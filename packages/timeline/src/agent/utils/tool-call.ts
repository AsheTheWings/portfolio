/**
 * Tool-call data utilities — pure functions for deriving
 * display name and status from tool-call component data.
 *
 * Used by CollapsibleShip headers (FlatInterface) and
 * SubViewRenderer (AgentMessage). Not coupled to any component.
 */

import type { SessionComponentData } from '../types';

/** Build human-readable tool display name from component data */
export function getToolDisplayName(data: SessionComponentData): string {
  const server = data.server as string | undefined;
  const tool = data.tool as string | undefined;
  const action = (data.arguments as { action?: string })?.action;
  return action ? `${server}/${tool}/${action}` : `${server}/${tool}`;
}

/** Derive execution status from tool-call component data */
export function getToolStatus(data: SessionComponentData): 'executing' | 'complete' | 'failed' {
  const result = data.result;
  if (data.server && result === undefined) return 'executing';
  const errorResult = result as { status?: string } | undefined;
  const mcpIsError = !!(result && typeof result === 'object' && (result as { isError?: boolean }).isError === true);
  return (errorResult?.status === 'error' || mcpIsError) ? 'failed' : 'complete';
}
