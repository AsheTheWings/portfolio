/**
 * Subtask Management Handlers
 */

import type { AgentJobsManager, Task, Subtask } from '../../../agent-jobs-manager';
import type { ActionResult } from './types';
import { generateSimpleId, getJobForWrite, commitJob } from './utils';

function getTaskOrThrow(job: { tasks: Task[]; id: string }, taskId: string): Task {
  const task = job.tasks.find((t: Task) => t.id === taskId);
  if (!task) {
    throw new Error(`manage_job: task "${taskId}" not found in job "${job.id}"`);
  }
  return task;
}

export async function handleAddSubtasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_id, subtasks } = params;
  if (!task_id || typeof task_id !== 'string') {
    throw new Error('manage_job: add_subtasks requires "task_id" (string)');
  }
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    throw new Error('manage_job: add_subtasks requires "subtasks" array with at least one description');
  }

  const task = getTaskOrThrow(job, task_id);

  const newSubtasks: Subtask[] = subtasks.map((description: string) => ({
    id: generateSimpleId('S'),
    taskId: task_id,
    description,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  }));

  task.subtasks.push(...newSubtasks);
  
  // Auto-update task status when subtasks are added
  if (task.status === 'pending') {
    task.status = 'in_progress';
  }

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Added ${newSubtasks.length} subtask(s) to task "${task.description}"`,
    task: {
      id: task.id,
      description: task.description,
      status: task.status,
      subtasks: task.subtasks,
    },
    job: snapshot,
  };
}

export async function handleRemoveSubtasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_id, subtask_ids } = params;
  if (!task_id || typeof task_id !== 'string') {
    throw new Error('manage_job: remove_subtasks requires "task_id" (string)');
  }
  if (!Array.isArray(subtask_ids) || subtask_ids.length === 0) {
    throw new Error('manage_job: remove_subtasks requires "subtask_ids" array with at least one item');
  }

  const task = getTaskOrThrow(job, task_id);

  const removed: string[] = [];
  const notFound: string[] = [];
  const idsToRemove = new Set(subtask_ids as string[]);

  task.subtasks = task.subtasks.filter((s: Subtask) => {
    if (idsToRemove.has(s.id)) {
      removed.push(s.id);
      return false;
    }
    return true;
  });

  subtask_ids.forEach((id: string) => {
    if (!removed.includes(id)) notFound.push(id);
  });

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Removed ${removed.length} subtask(s) from task "${task.description}"`,
    removed,
    notFound: notFound.length > 0 ? notFound : undefined,
    job: snapshot,
  };
}

export async function handleStartSubtasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_id, subtask_ids } = params;
  if (!task_id || typeof task_id !== 'string') {
    throw new Error('manage_job: start_subtasks requires "task_id" (string)');
  }
  if (!Array.isArray(subtask_ids) || subtask_ids.length === 0) {
    throw new Error('manage_job: start_subtasks requires "subtask_ids" array with at least one item');
  }

  const task = getTaskOrThrow(job, task_id);

  const started: string[] = [];
  const notFound: string[] = [];
  const now = new Date().toISOString();
  const idsToStart = new Set(subtask_ids as string[]);

  task.subtasks.forEach((subtask: Subtask) => {
    if (idsToStart.has(subtask.id)) {
      if (subtask.status === 'pending') {
        subtask.status = 'in_progress';
        subtask.startedAt = now;
        started.push(subtask.id);
      }
    }
  });

  subtask_ids.forEach((id: string) => {
    if (!started.includes(id) && !task.subtasks.some((s: Subtask) => s.id === id)) {
      notFound.push(id);
    }
  });

  // Auto-update task status when subtasks are started
  if (task.status === 'pending') {
    task.status = 'in_progress';
  }

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Started ${started.length} subtask(s) in task "${task.description}"`,
    started,
    notFound: notFound.length > 0 ? notFound : undefined,
    task: {
      id: task.id,
      description: task.description,
      status: task.status,
      subtasks: task.subtasks,
    },
    job: snapshot,
  };
}

export async function handleCompleteSubtasks(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { task_id, subtask_ids } = params;
  if (!task_id || typeof task_id !== 'string') {
    throw new Error('manage_job: complete_subtasks requires "task_id" (string)');
  }
  if (!Array.isArray(subtask_ids) || subtask_ids.length === 0) {
    throw new Error('manage_job: complete_subtasks requires "subtask_ids" array with at least one item');
  }

  const task = getTaskOrThrow(job, task_id);

  const completed: string[] = [];
  const notFound: string[] = [];
  const now = new Date().toISOString();
  const idsToComplete = new Set(subtask_ids as string[]);

  task.subtasks.forEach((subtask: Subtask) => {
    if (idsToComplete.has(subtask.id)) {
      subtask.status = 'completed';
      subtask.completedAt = now;
      completed.push(subtask.id);
    }
  });

  subtask_ids.forEach((id: string) => {
    if (!completed.includes(id)) notFound.push(id);
  });

  // Auto-complete task if all subtasks are complete
  let taskAutoCompleted = false;
  if (task.subtasks.length > 0 && task.subtasks.every((s: Subtask) => s.status === 'completed')) {
    task.status = 'completed';
    task.completedAt = now;
    taskAutoCompleted = true;
  }

  const snapshot = commitJob(job, manager);

  // Include task ID in completed if auto-completed (for workflow detection)
  const completedIds = taskAutoCompleted ? [...completed, task.id] : completed;

  return {
    status: 'success',
    message: taskAutoCompleted
      ? `Marked ${completed.length} subtask(s) as complete in task "${task.description}" (task auto-completed)`
      : `Marked ${completed.length} subtask(s) as complete in task "${task.description}"`,
    completed: completedIds,
    notFound: notFound.length > 0 ? notFound : undefined,
    task: {
      id: task.id,
      description: task.description,
      status: task.status,
      subtasks: task.subtasks,
    },
    job: snapshot,
  };
}
