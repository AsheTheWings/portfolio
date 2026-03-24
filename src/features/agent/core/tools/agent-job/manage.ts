/**
 * Manage Job Tool - Handler
 * 
 * Routes manage_job actions to specialized handlers
 * Uses handler registry pattern for clean action dispatch
 */

import type { AgentJobsManager } from '../../agent-jobs-manager';
import type { ActionHandler, ActionResult } from './src/types';
import type { AgentConfig, AgentMetadata } from '../../../types';

// Import handlers from specialized modules
import { handleAddTasks, handleRemoveTasks, handleCompleteTasks } from './src/tasks';
import { handleAddSubtasks, handleRemoveSubtasks, handleStartSubtasks, handleCompleteSubtasks } from './src/subtasks';
import { handleAddIssue, handleUpdateIssue, handleListIssues } from './src/issues';
import { handleGetJob, handleCancelJob } from './src/lifecycle';
import { handleSystemAction } from './src/system-action';

// Handler registry - maps action names to handlers
const handlers: Record<string, ActionHandler> = {
  // Task management
  add_tasks: handleAddTasks,
  remove_tasks: handleRemoveTasks,
  complete_tasks: handleCompleteTasks,

  // Subtask management
  add_subtasks: handleAddSubtasks,
  remove_subtasks: handleRemoveSubtasks,
  start_subtasks: handleStartSubtasks,
  complete_subtasks: handleCompleteSubtasks,

  // Issue management
  add_issue: handleAddIssue,
  update_issue: handleUpdateIssue,
  list_issues: handleListIssues,

  // Job lifecycle
  get_job: handleGetJob,
  cancel_job: handleCancelJob,

  // System actions (internal)
  _system_action: handleSystemAction,
};

// Write actions that mutate job state - cannot be performed on terminated jobs
const writeActions = new Set([
  'add_tasks',
  'remove_tasks',
  'complete_tasks',
  'add_subtasks',
  'remove_subtasks',
  'start_subtasks',
  'complete_subtasks',
  'add_issue',
  'update_issue',
  'cancel_job',
]);

/**
 * Handle manage_job tool execution
 * No user feedback required - executes directly
 */
export async function handleManageJob(
  args: Record<string, unknown>,
  context: { agentConfig?: AgentConfig; userFeedback?: unknown; jobsManager?: AgentJobsManager; turnId?: string; turnMetadata?: AgentMetadata }
): Promise<ActionResult> {
  const { action: rawAction, job_id: rawJobId, ...params } = args;
  const action = rawAction as string;
  const job_id = rawJobId as string;

  if (!context.jobsManager) {
    throw new Error('manage_job: jobsManager not available in context');
  }

  const handler = handlers[action];
  if (!handler) {
    const userActions = Object.keys(handlers).filter(a => !a.startsWith('_'));
    throw new Error(`manage_job: invalid action "${action}". Valid actions: ${userActions.join(', ')}`);
  }

  // Guard: prevent write actions on terminated jobs
  if (writeActions.has(action) && job_id) {
    const job = await context.jobsManager!.getJob(job_id);
    if (job && (job.status === 'completed' || job.status === 'cancelled')) {
      return {
        status: 'error',
        message: `Job "${job.title}" is already ${job.status}. Cannot perform ${action} on terminated jobs.`,
        job: undefined,
        toolEffects: {},
      };
    }
  }

  const result = await handler(job_id, params, context.jobsManager);

  // No job in result - nothing to update
  if (!result?.job) {
    return result;
  }

  const job = result.job;

  // Aggregate turn metadata into job metadata
  let computedJobMetadata: AgentMetadata | undefined;
  if (context.turnMetadata && context.turnId) {
    computedJobMetadata = context.jobsManager.aggregateMetadata(job.id, context.turnId, context.turnMetadata);
  }

  // Auto-handle terminal status (completed/cancelled) - exit background mode
  if (job.status === 'completed' || job.status === 'cancelled') {
    // Finalize job metadata (commit active into stable)
    context.jobsManager.finalizeJobMetadata(job.id);

    result.toolEffects = {
      ...result.toolEffects,
      setBackgroundMode: { active: false },
      setActiveJob: { job: null },
      sessionComponents: [
        // Final dashboard update
        {
          id: `${job.id}-dashboard`,
          role: 'agent' as const,
          type: 'agent-job-dashboard' as const,
          hideComponent: true,
          data: {
            job,
            jobMetadata: computedJobMetadata,
            isBackground: true,
            jobId: job.id,
          },
        },
        // Summary component
        {
          id: `${job.id}-summary`,
          role: 'agent' as const,
          type: 'agent-job-summary' as const,
          data: {
            job,
            jobMetadata: computedJobMetadata,
            jobId: job.id,
            isBackground: true,
          },
        },
      ],
    };
  } else {
    // Non-terminal: update dashboard + re-emit workflow activation for cross-turn persistence
    result.toolEffects = {
      ...result.toolEffects,
      sessionComponents: [
        ...(result.toolEffects?.sessionComponents || []),
        {
          id: `${job.id}-dashboard`,
          role: 'agent' as const,
          type: 'agent-job-dashboard' as const,
          hideComponent: true,
          data: {
            job,
            jobMetadata: computedJobMetadata,
            isBackground: true,
            jobId: job.id,
          },
        },
      ],
      // Re-emit workflow activation for cross-turn persistence (silently ignored if not enabled)
      activateWorkflow: {
        type: 'agentJob',
        data: { jobId: job.id },
      },
    };
  }

  return result;
}
