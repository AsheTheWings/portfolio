/**
 * Agent Job Handler Types
 */

import type { AgentJobsManager } from '../../../agent-jobs-manager';
import type { ToolEffects } from '../../../../types';

/** Handler function signature */
export type ActionHandler = (
  jobId: string,
  params: Record<string, unknown>,
  manager: AgentJobsManager
) => Promise<ActionResult>;

/** Standard result format for job action handlers */
export interface ActionResult {
  status: 'success' | 'error' | 'cancelled' | 'approved' | 'rejected' | 'pending' | 'feedback';
  message: string;
  job?: ReturnType<AgentJobsManager['getJobSnapshot']>;
  toolEffects?: ToolEffects;
  executedApprovalId?: string;  // Tracks which approval was executed
  canComplete?: boolean;        // For system check results
  incompleteTasks?: unknown[];      // For rejection details
  [key: string]: unknown;
}

