/**
 * Create Job Tool - Handler
 * 
 * Proposes job creation with user approval
 * Jobs represent complex tasks or multi-step workflows
 * 
 * Event-sourced flow:
 * 1. Agent calls create_job({ title, description, tasks })
 * 2. Tool returns toolEffects with userActions (approval buttons)
 * 3. tool-effects event triggers feedback mode via useToolEffects
 * 4. User provides feedback (approve/cancel/text feedback)
 * 5. Session emits user-feedback-result event
 * 6. Tool is re-executed with userFeedback in context
 * 7. Tool processes response and returns job creation result
 */

import { generateSimpleId } from './src/utils';
import type { AgentJobsManager, Job, Task } from '../../agent-jobs-manager';
import type { AgentConfig } from '../../../types';
import type { ActionResult } from './src/types';

export interface JobSpecification {
  title: string;
  description: string;
  tasks: string[];  // At least 1 task required
}

/**
 * Handle create_job tool execution
 * Only executes when user feedback is provided (session prevents premature execution)
 */
export async function handleCreateJob(
  args: Record<string, unknown>,
  context: { agentConfig?: AgentConfig; userFeedback?: unknown; componentId?: string; jobsManager?: AgentJobsManager; turnId?: string }
): Promise<ActionResult> {
  const { componentId, jobsManager, turnId } = context;
  const userFeedback = context.userFeedback as { action?: string; userFeedback?: string } | undefined;

  // Validate jobsManager
  if (!jobsManager) {
    throw new Error('create_job: jobsManager not available in context');
  }

  // Ensure jobs are initialized before creating new job
  await jobsManager.ensureInitialized();

  // Validate required fields
  if (!args.title || typeof args.title !== 'string') {
    throw new Error('create_job: missing required field "title" (string)');
  }

  if (!args.description || typeof args.description !== 'string') {
    throw new Error('create_job: missing required field "description" (string)');
  }

  if (!Array.isArray(args.tasks) || args.tasks.length < 3) {
    throw new Error('create_job: "tasks" must be an array with at least 3 task descriptions (jobs are for multi-step workflows)');
  }

  // Extract job specification from arguments
  const jobSpec: JobSpecification = {
    title: args.title,
    description: args.description,
    tasks: args.tasks,
  };

  // Component ID for creation component (proposal → created transition)
  const creationComponentId = `${componentId}-creation`;

  // No feedback yet - request user approval via toolEffects
  if (!userFeedback) {
    return {
      status: 'pending',
      message: `Awaiting approval for job "${jobSpec.title}"`,
      proposal: jobSpec,
      toolEffects: {
        // Create proposal component (will be updated to created state on approval)
        sessionComponents: [{
          id: creationComponentId,
          role: 'agent' as const,
          type: 'agent-job-creation' as const,
          data: {
            state: 'proposal' as const,
            proposal: jobSpec,
          },
        }],
        // Request user approval
        userActions: {
          prompt: 'Do you approve this job?',
          actions: [
            {
              id: 'approve',
              label: 'Approve',
              variant: 'default',
              icon: 'Check',
              iconPosition: 'left',
              description: 'Accept and create the job',
              primary: true,
            },
            {
              id: 'cancel',
              label: 'Cancel',
              variant: 'outline',
              icon: 'X',
              iconPosition: 'left',
              description: 'Reject the job proposal',
            },
          ],
        },
      },
    };
  }

  // Process user feedback response
  const action = userFeedback.action;

  if (action === 'approve') {
    // Job approved - create and store job
    const now = new Date().toISOString();
    const jobId = generateSimpleId('J');

    // Convert task descriptions to Task objects
    const tasks: Task[] = jobSpec.tasks.map(description => ({
      id: generateSimpleId('T'),
      description,
      status: 'pending' as const,
      subtasks: [],
      createdAt: now,
    }));

    const job: Job = {
      id: jobId,
      turnId: turnId || '',
      title: jobSpec.title,
      description: jobSpec.description,
      tasks,
      issues: [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    // Store job in jobsManager
    jobsManager.setJob(job);

    const jobSnapshot = jobsManager.getJobSnapshot(job);

    return {
      status: 'approved',
      message: `Job "${jobSpec.title}" created successfully with ID: ${jobId}`,
      job: jobSnapshot,
      toolEffects: {
        // Enter background mode (events hidden from foreground)
        setBackgroundMode: { active: true },
        // Set active job context (events stamped with jobId)
        setActiveJob: { job: { jobId: job.id, title: job.title } },
        // Update creation component to created state + create dashboard
        // Order matters: last component with jobId in data shows JobActionBar
        sessionComponents: [
          // Dashboard component for BackgroundJobInterface (hidden from foreground)
          {
            id: `${job.id}-dashboard`,
            role: 'agent' as const,
            type: 'agent-job-dashboard' as const,
            hideComponent: true,  // UI: hide from foreground
            data: {
              job: jobSnapshot,
              isBackground: true,  // Domain: created in background mode
              jobId: job.id,
            },
          },
          // Update proposal → created (visible in foreground)
          {
            id: creationComponentId,
            role: 'agent' as const,
            type: 'agent-job-creation' as const,
            data: {
              state: 'created' as const,
              proposal: jobSpec,
              job: jobSnapshot,
              isBackground: true,  // Domain: created in background mode
              jobId: job.id,
            },
          },
        ],
        // Activate agent job workflow (silently ignored if workflow not enabled)
        activateWorkflow: {
          type: 'agentJob',
          data: { jobId },
        },
      },
    };
  } else if (action === 'cancel') {
    return {
      status: 'cancelled',
      message: `Job creation cancelled`,
    };
  } else if (userFeedback.userFeedback) {
    // User provided text feedback - return it for agent to iterate
    return {
      status: 'feedback',
      userFeedback: userFeedback.userFeedback,
      message: 'User provided feedback on your job proposal.',
    };
  } else {
    throw new Error('create_job: invalid feedback data (expected action: "approve"/"cancel" or userFeedback text)');
  }
}
