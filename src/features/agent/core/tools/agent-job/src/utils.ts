/**
 * Job Utilities
 * Shared utilities for job management
 */

import type { AgentJobsManager, Job } from '../../../agent-jobs-manager';

/**
 * Generate a simple 6-character ID
 * Format: 3 uppercase letters + 3 numbers (e.g., XYZ123)
 */
export function generateSimpleId(prefix: string = ''): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let id = '';
  for (let i = 0; i < 3; i++) {
    id += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i++) {
    id += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Get job or throw error - common lookup pattern
 */
export async function getJobOrThrow(jobId: string, manager: AgentJobsManager): Promise<Job> {
  const job = await manager.getJob(jobId);
  if (!job) {
    throw new Error(`manage_job: job "${jobId}" not found`);
  }
  return job;
}

/**
 * Get job for write operation - throws if job is in terminal state
 */
export async function getJobForWrite(jobId: string, manager: AgentJobsManager): Promise<Job> {
  const job = await getJobOrThrow(jobId, manager);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw new Error(`manage_job: job "${jobId}" is ${job.status} and cannot be modified`);
  }
  return job;
}

/**
 * Commit job changes - updates timestamp and saves
 */
export function commitJob(job: Job, manager: AgentJobsManager): ReturnType<AgentJobsManager['getJobSnapshot']> {
  job.updatedAt = new Date().toISOString();
  updateJobStatus(job);
  manager.setJob(job);
  return manager.getJobSnapshot(job);
}

/**
 * Auto-update job status based on tasks
 */
export function updateJobStatus(job: Job): void {
  if (job.tasks.length === 0) {
    job.status = 'pending';
  } else {
    const allComplete = job.tasks.every((t: { status: string }) => t.status === 'completed');
    job.status = allComplete ? 'completed' : 'in_progress';
  }
}

