/**
 * System Action Handlers
 * Internal actions triggered by system, not agent
 */

import type { AgentJobsManager, Task, Subtask } from '../../../agent-jobs-manager';
import type { ActionResult } from './types';
import { getJobOrThrow } from './utils';

interface SystemActionParams {
  caller: 'system';
  operation: 'check' | 'cancel';
  trigger?: 'system' | 'user';
  trigger_source?: string;
  _approvalId?: string;  // Tracking ID from agentJob workflow
}

export async function handleSystemAction(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  if (params?.caller !== 'system') {
    throw new Error(
      'manage_job: _system_action is reserved for system use. ' +
      'Use get_job to check job status, or cancel_job to cancel.'
    );
  }

  const { operation, trigger, trigger_source, _approvalId } = params as SystemActionParams;

  let result: ActionResult;
  
  switch (operation) {
    case 'check':
      result = await handleSystemCheck(jobId, manager);
      break;
    case 'cancel':
      result = await handleSystemCancel(jobId, trigger, trigger_source, manager);
      break;
    default:
      throw new Error(`manage_job: _system_action unknown operation "${operation}"`);
  }

  // Only mark approval as executed if terminal (approved/cancelled)
  // Rejection means agent should continue working, then re-check
  if (_approvalId && (result.status === 'approved' || result.status === 'cancelled')) {
    result.executedApprovalId = _approvalId;
  }

  return result;
}

async function handleSystemCheck(
  jobId: string,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobOrThrow(jobId, manager);

  // Job already terminal
  if (job.status === 'completed' || job.status === 'cancelled') {
    return {
      status: 'approved',
      message: `[System] Job "${job.title}" is ${job.status}. Agent turn can complete.`,
      canComplete: true,
      job: manager.getJobSnapshot(job),
    };
  }

  // Check for incomplete tasks
  const incompleteTasks = job.tasks.filter((t: Task) => t.status !== 'completed');
  
  if (incompleteTasks.length === 0) {
    // All tasks complete - mark job as complete
    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
    manager.setJob(job);
    return {
      status: 'approved',
      message: `[System] All tasks in job "${job.title}" are complete. Agent turn can complete.`,
      canComplete: true,
      job: manager.getJobSnapshot(job),
    };
  }

  // Job has incomplete tasks
  const taskSummary = incompleteTasks.map((t: Task) => ({
    id: t.id,
    description: t.description,
    status: t.status,
    subtasksTotal: t.subtasks.length,
    subtasksCompleted: t.subtasks.filter((s: Subtask) => s.status === 'completed').length,
  }));

  return {
    status: 'rejected',
    message: `[System] Job "${job.title}" has ${incompleteTasks.length} incomplete task(s). Before completing your turn, you must either:
1. Complete remaining tasks by finishing their work
2. Mark tasks as complete using complete_tasks action
3. Cancel the job using cancel_job action

Incomplete tasks:
${taskSummary.map(t => `- ${t.id}: "${t.description}" (${t.status}) - ${t.subtasksCompleted}/${t.subtasksTotal} subtasks complete`).join('\n')}`,
    canComplete: false,
    incompleteTasks: taskSummary,
    job: manager.getJobSnapshot(job),
  };
}

async function handleSystemCancel(
  jobId: string,
  trigger: 'system' | 'user' | undefined,
  triggerSource: string | undefined,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobOrThrow(jobId, manager);

  // Already in terminal state
  if (job.status === 'completed' || job.status === 'cancelled') {
    return {
      status: 'success',
      message: `[System] Job "${job.title}" is already ${job.status}.`,
      job: manager.getJobSnapshot(job),
    };
  }

  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  manager.setJob(job);

  const attribution = trigger === 'user'
    ? triggerSource 
      ? `[System] User requested cancellation (${triggerSource}).`
      : '[System] User requested cancellation.'
    : '[System] Job cancelled by system.';

  return {
    status: 'cancelled',
    message: `${attribution} Job "${job.title}" has been cancelled.`,
    job: manager.getJobSnapshot(job),
  };
}
