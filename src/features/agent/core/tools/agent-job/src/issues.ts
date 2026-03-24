/**
 * Issue Management Handlers
 */

import type { AgentJobsManager, Issue, Task } from '../../../agent-jobs-manager';
import type { ActionResult } from './types';
import { generateSimpleId, getJobOrThrow, getJobForWrite, commitJob } from './utils';

export async function handleAddIssue(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { title, problem, context, task_id } = params;
  if (!title || typeof title !== 'string') {
    throw new Error('manage_job: add_issue requires "title" (string)');
  }
  if (!problem || typeof problem !== 'string') {
    throw new Error('manage_job: add_issue requires "problem" (string)');
  }

  // Validate task_id if provided
  if (task_id && !job.tasks.find((t: Task) => t.id === task_id)) {
    throw new Error(`manage_job: task "${task_id}" not found in job "${jobId}"`);
  }

  const issue: Issue = {
    id: generateSimpleId('I'),
    jobId,
    taskId: task_id,
    title,
    problem,
    context,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  if (!job.issues) {
    job.issues = [];
  }
  job.issues.push(issue);
  
  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Issue "${title}" logged for job "${job.title}"`,
    issue: {
      id: issue.id,
      title: issue.title,
      problem: issue.problem,
      status: issue.status,
      taskId: issue.taskId,
    },
    job: snapshot,
  };
}

export async function handleUpdateIssue(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobForWrite(jobId, manager);

  const { issue_id, solution, status } = params;
  if (!issue_id || typeof issue_id !== 'string') {
    throw new Error('manage_job: update_issue requires "issue_id" (string)');
  }

  const issue = job.issues?.find((i: Issue) => i.id === issue_id);
  if (!issue) {
    throw new Error(`manage_job: issue "${issue_id}" not found in job "${jobId}"`);
  }

  if (solution !== undefined) {
    issue.solution = solution;
  }

  if (status) {
    if (!['open', 'resolved', 'verified'].includes(status)) {
      throw new Error('manage_job: status must be "open", "resolved", or "verified"');
    }
    issue.status = status;
    if (status === 'resolved' || status === 'verified') {
      issue.resolvedAt = new Date().toISOString();
    }
  }

  const snapshot = commitJob(job, manager);

  return {
    status: 'success',
    message: `Issue "${issue.title}" updated`,
    issue: {
      id: issue.id,
      title: issue.title,
      problem: issue.problem,
      solution: issue.solution,
      status: issue.status,
      taskId: issue.taskId,
    },
    job: snapshot,
  };
}

export async function handleListIssues(
  jobId: string,
  params: Record<string, any>,
  manager: AgentJobsManager
): Promise<ActionResult> {
  const job = await getJobOrThrow(jobId, manager);

  const { status, task_id } = params;
  let issues = job.issues || [];

  if (status) {
    if (!['open', 'resolved', 'verified'].includes(status)) {
      throw new Error('manage_job: status must be "open", "resolved", or "verified"');
    }
    issues = issues.filter((i: Issue) => i.status === status);
  }

  if (task_id) {
    issues = issues.filter((i: Issue) => i.taskId === task_id);
  }

  return {
    status: 'success',
    message: `Found ${issues.length} issue(s)`,
    issues: issues.map((i: Issue) => ({
      id: i.id,
      title: i.title,
      problem: i.problem,
      solution: i.solution,
      context: i.context,
      status: i.status,
      taskId: i.taskId,
      createdAt: i.createdAt,
      resolvedAt: i.resolvedAt,
    })),
    count: issues.length,
  };
}
