/**
 * Job Lifecycle Handlers
 * get_job, cancel_job
 */

import type { AgentJobsManager } from '../../../agent-jobs-manager';
import type { ActionResult } from './types';
import { getJobOrThrow } from './utils';

export async function handleGetJob(
  jobId: string,
  _params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobOrThrow(jobId, manager);

  return {
    status: 'success',
    message: `Retrieved job "${job.title}"`,
    job: manager.getJobSnapshot(job),
  };
}

export async function handleCancelJob(
  jobId: string,
  _params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobOrThrow(jobId, manager);

  // Already in terminal state
  if (job.status === 'completed' || job.status === 'cancelled') {
    return {
      status: 'success',
      message: `Job "${job.title}" is already ${job.status}.`,
      job: manager.getJobSnapshot(job),
    };
  }

  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  manager.setJob(job);

  return {
    status: 'cancelled',
    message: `Job "${job.title}" has been cancelled.`,
    job: manager.getJobSnapshot(job),
  };
}
