/**
 * Task Management Handlers
 */

import type { AgentJobsManager, Task } from '../../../agent-jobs-manager';
import type { ActionResult } from './types';
import { generateSimpleId, getJobForWrite, commitJob } from './utils';

export async function handleAddTasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { tasks } = params;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('manage_job: add_tasks requires "tasks" array with at least one task description');
  }

  const newTasks: Task[] = tasks.map((description: string) => ({
    id: generateSimpleId('T'),
    description,
    status: 'pending' as const,
    subtasks: [],
    createdAt: new Date().toISOString(),
  }));

  job.tasks.push(...newTasks);
  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Added ${newTasks.length} task(s) to job "${job.title}"`,
    job: snapshot,
  };
}

export async function handleRemoveTasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_ids } = params;
  if (!Array.isArray(task_ids) || task_ids.length === 0) {
    throw new Error('manage_job: remove_tasks requires "task_ids" array with at least one item');
  }

  const removed: string[] = [];
  const notFound: string[] = [];

  // Use filter instead of splice for cleaner removal
  const idsToRemove = new Set(task_ids as string[]);
  const originalLength = job.tasks.length;
  
  job.tasks = job.tasks.filter((t: Task) => {
    if (idsToRemove.has(t.id)) {
      removed.push(t.id);
      return false;
    }
    return true;
  });

  // Find IDs that weren't in the job
  task_ids.forEach((id: string) => {
    if (!removed.includes(id)) notFound.push(id);
  });

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Removed ${removed.length} task(s) from job "${job.title}"`,
    removed,
    notFound: notFound.length > 0 ? notFound : undefined,
    job: snapshot,
  };
}

export async function handleCompleteTasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_ids } = params;
  if (!Array.isArray(task_ids) || task_ids.length === 0) {
    throw new Error('manage_job: complete_tasks requires "task_ids" array with at least one item');
  }

  const completed: { id: string; title: string }[] = [];
  const notFound: string[] = [];
  const now = new Date().toISOString();
  const idsToComplete = new Set(task_ids as string[]);

  job.tasks.forEach((task: Task) => {
    if (idsToComplete.has(task.id)) {
      task.status = 'completed';
      task.completedAt = now;
      completed.push({ id: task.id, title: task.description });
    }
  });

  // Find IDs that weren't in the job
  task_ids.forEach((id: string) => {
    if (!completed.some(c => c.id === id)) notFound.push(id);
  });

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Marked ${completed.length} task(s) as complete in job "${job.title}"`,
    completed: completed.map(c => c.id),
    notFound: notFound.length > 0 ? notFound : undefined,
    job: snapshot,
  };
}
